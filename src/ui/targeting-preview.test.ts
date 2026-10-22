import { describe, expect, it } from 'vitest';
import { clone, config, type EnemyKind, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { Session, type Unit } from '../game/session';
import { targetingPreview } from './targeting-preview';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}
function session(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}
function order(s: Session, column = 1): number[] {
  return targetingPreview(s.preparation, column).rows.flatMap((r) => r.units.map((u) => u.id));
}

describe('当前阵容受击顺序预览', () => {
  it.each<EnemyKind>(['wolf', 'runner', 'croc', 'ranged', 'summoner', 'splitter', 'boss'])(
    '%s在各实际入场列的首次寻敌和清排后的寻敌与预览一致',
    (kind) => {
      const s = session([
        unit(10, 'ember_mouse', 1, 2, 2),
        unit(11, 'fortune_peach', 4, 2, 3),
        unit(12, 'shield_fox', 3, 4),
        unit(13, 'fortune_peach', 5, 5),
      ]);
      for (const column of config.waves.spawnColumns) {
        const preview = targetingPreview(s.preparation, column);
        const battle = createCombat(s.preparation.units, { stageId: 5 });
        battle.spawns = [];
        battle.allies.forEach((u) => {
          u.cooldown = 100000;
        });
        const enemy = spawnEnemy(battle, kind, preview.reference);
        enemy.cooldown = 100000;
        const expected = preview.rows.flatMap((r) => r.units);
        for (const target of expected) {
          // Reset to the displayed reference point, explicitly modelling a static lookup.
          enemy.x = preview.reference.x;
          enemy.y = preview.reference.y;
          enemy.recheckAt = 0;
          stepCombat(battle);
          expect(enemy.target).toBe(target.id);
          battle.allies.find((u) => u.id === target.id)!.hp = 0;
        }
      }
    },
  );

  it('逐排优先于阶数/仇恨/距离，空行不列出，编号跨排连续', () => {
    const s = session([
      unit(10, 'sword_eagle', 0, 0, 6),
      unit(11, 'fortune_peach', 5, 2),
      unit(12, 'shield_fox', 5, 5),
    ]);
    const preview = targetingPreview(s.preparation, 5);
    expect(preview.rows.map((r) => r.row)).toEqual([0, 2, 5]);
    expect(preview.rows.flatMap((r) => r.units.map((u) => u.order))).toEqual([1, 2, 3]);
    expect(order(s, 5)).toEqual([10, 11, 12]);
    expect(preview.first).toMatchObject({ id: 10, position: { x: 0, y: 0 } });
  });

  it('同排低阶先于高仇恨，同阶依桃狐鼠豚熊猴鲤隼', () => {
    const kinds: HeroId[] = [
      'fortune_peach',
      'shield_fox',
      'ember_mouse',
      'boar',
      'scatter_bear',
      'piercing_monkey',
      'ice_fish',
      'sword_eagle',
    ];
    // Test each adjacent pair in a legal layout: all eight cannot share one board row.
    for (let i = 0; i < kinds.length - 1; i++) {
      const s = session([unit(10, kinds[i], 0, 0, 3), unit(11, kinds[i + 1], 3, 0, 3)]);
      expect(order(s, 5)).toEqual([10, 11]);
      s.preparation.units[1].rank = 2;
      expect(order(s, 5)).toEqual([11, 10]);
    }
  });

  it('距离随入场列改变，距离相同用ID消歧，不依赖数组顺序', () => {
    const s = session([unit(90, 'ember_mouse', 1, 2), unit(10, 'ember_mouse', 5, 2)]);
    expect(order(s, 1)).toEqual([90, 10]);
    expect(order(s, 5)).toEqual([10, 90]);
    expect(order(s, 3)).toEqual([10, 90]);
    s.preparation.units.reverse();
    expect(order(s, 3)).toEqual([10, 90]);
  });

  it('多格按最上占格归排，寻敌使用实战占格距离', () => {
    const s = session([
      unit(90, 'boar', 0, 1),
      unit(10, 'boar', 3, 1),
      unit(11, 'ice_fish', 5, 2),
      unit(12, 'fortune_peach', 0, 3),
    ]);
    // Reference column 3: nearest contact distances tie (1 cell horizontal each), ID 10 wins.
    expect(order(s, 2)).toEqual([10, 90, 11, 12]);
    const preview = targetingPreview(s.preparation, 2);
    expect(preview.rows.map((r) => r.row)).toEqual([1, 2, 3]);
  });

  it('排除备战席与未领取招募；空阵容没有首目标', () => {
    const s = session([{ ...unit(10, 'fortune_peach', 0, 0), position: null }]);
    expect(targetingPreview(s.preparation, 1)).toMatchObject({ first: null, rows: [] });
    s.preparation.units.push(unit(11, 'ember_mouse', 1, 3));
    expect(order(s)).toEqual([11]);
  });

  it('换位、撤销与合成后立即按当前阵容重算，预览不消耗撤销或修改状态', () => {
    const s = session([unit(10, 'fortune_peach', 1, 2, 2), unit(11, 'ember_mouse', 4, 2)]);
    expect(order(s)).toEqual([11, 10]);
    expect(s.swap(10, 11)).toBeNull();
    const before = clone(s.preparation);
    const revision = s.revision;
    const preview = targetingPreview(s.preparation, 5);
    expect(preview.first!.position).toEqual({ x: 1, y: 2 });
    preview.first!.position.x = 99;
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units[1].position).toEqual({ x: 4, y: 2 });
    expect(s.transfer({ type: 'offer', id: 1 }, { merge: 11 })).toBeNull();
    expect(order(s)).toEqual([10, 11]);
    expect(targetingPreview(s.preparation, 1).rows[0].units[1].rank).toBe(2);
  });

  it.each([-1, 6, NaN, Infinity, 1.5])(
    '无效参考列%s回到默认出怪列，不改变Preparation',
    (column) => {
      const s = session([unit(10, 'ember_mouse', 1, 3)]);
      const before = clone(s.preparation);
      const result = targetingPreview(s.preparation, column);
      expect(result.column).toBe(config.waves.spawnColumns[0]);
      expect(result.reference).toEqual({
        x: config.waves.spawnColumns[0] + 0.5,
        y: config.waves.spawnRow,
      });
      expect(s.preparation).toEqual(before);
    },
  );
});
