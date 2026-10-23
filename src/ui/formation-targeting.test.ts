import { describe, expect, it } from 'vitest';
import { config, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { captureFormation, planFormation } from '../game/formation-presets';
import { Session, type Unit } from '../game/session';
import { formationTargeting } from './formation-targeting';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}
function prepared(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.nextId = Math.max(...units.map((u) => u.id)) + 1;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}

describe('预设应用前后首个寻敌目标', () => {
  it('前后使用同一真实入口，均与实际首次寻敌一致，应用和撤销不影响预览', () => {
    const s = prepared([unit(10, 'fortune_peach', 0, 0, 3), unit(11, 'ember_mouse', 4, 2, 2)]);
    const preset = captureFormation(s.preparation.units);
    expect(s.swap(10, 11)).toBeNull();
    const plan = planFormation(s.preparation, preset);
    const before = JSON.stringify({ s, plan, preset });
    const view = formationTargeting(s.preparation, plan)!;
    expect(view.map((row) => row.column)).toEqual(config.waves.spawnColumns);
    for (const row of view) {
      expect(row.before!.id).toBe(11);
      expect(row.after!.id).toBe(10);
      if (!('units' in plan)) throw new Error('Expected a successful plan');
      for (const [units, target] of [
        [s.preparation.units, row.before],
        [plan.units, row.after],
      ] as const) {
        const battle = createCombat(units, { stageId: 5, progression: s.preparation.progression });
        battle.spawns = [];
        battle.allies.forEach((ally) => {
          ally.cooldown = 100000;
        });
        const enemy = spawnEnemy(battle, 'wolf', { x: row.column + 0.5, y: config.waves.spawnRow });
        enemy.cooldown = 100000;
        stepCombat(battle);
        expect(enemy.target).toBe(target!.id);
      }
    }
    expect(JSON.stringify({ s, plan, preset })).toBe(before);
    expect(s.applyFormation(preset)).toBeNull();
    // Same positioning is rejected by the real planner, so no comparison remains.
    expect(formationTargeting(s.preparation, planFormation(s.preparation, preset))).toBeNull();
    expect(s.undo()).toBeNull();
    expect(formationTargeting(s.preparation, planFormation(s.preparation, preset))).toEqual(view);
  });

  it('同排先低阶再高仇恨，备战桃不抢目标，多格按最上占格归排', () => {
    const s = prepared([
      unit(10, 'sword_eagle', 0, 0, 6),
      unit(11, 'shield_fox', 4, 2, 3),
      unit(12, 'ember_mouse', 2, 2, 2),
      { ...unit(13, 'fortune_peach', 0, 0), position: null },
    ]);
    const preset = captureFormation(s.preparation.units);
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 0, y: 4 })).toBeNull();
    const view = formationTargeting(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.every((row) => row.before!.id === 12 && row.after!.id === 10)).toBe(true);
    s.preparation.units[2].rank = 3;
    const newPreset = captureFormation(s.preparation.units);
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 0, y: 0 })).toBeNull();
    expect(
      formationTargeting(s.preparation, planFormation(s.preparation, newPreset))![0].after!.id,
    ).toBe(11);
  });

  it('同种同阶按入口距离与ID消歧，阵容数组顺序不改变实例对应', () => {
    const s = prepared([unit(90, 'ember_mouse', 1, 2), unit(10, 'ember_mouse', 5, 2)]);
    const preset = captureFormation(s.preparation.units);
    expect(s.swap(90, 10)).toBeNull();
    s.preparation.units.reverse();
    const plan = planFormation(s.preparation, preset);
    const view = formationTargeting(s.preparation, plan)!;
    expect(view.map((row) => [row.before!.id, row.after!.id])).toEqual([
      [10, 90],
      [10, 10],
      [90, 10],
    ]);
  });

  it('当前空场仍可对照将上阵实例，无目标用null，不计未领取招募', () => {
    const s = prepared([unit(10, 'fortune_peach', 0, 0)]);
    const preset = captureFormation(s.preparation.units);
    s.preparation.units[0].position = null;
    const view = formationTargeting(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.every((row) => row.before === null && row.after!.id === 10)).toBe(true);
  });

  it('无预设及任何校验错误均不生成对照，读取不改状态且位置无共享', () => {
    const s = prepared([unit(10, 'boar', 0, 0), unit(11, 'ember_mouse', 4, 3)]);
    const preset = captureFormation(s.preparation.units);
    expect(formationTargeting(s.preparation, null)).toBeNull();
    expect(formationTargeting(s.preparation, planFormation(s.preparation, {}))).toBeNull();
    s.transfer({ type: 'unit', id: 10 }, { x: 2, y: 0 });
    const plan = planFormation(s.preparation, preset);
    const before = JSON.stringify({ s, plan });
    const view = formationTargeting(s.preparation, plan)!;
    expect(formationTargeting(s.preparation, plan)).toEqual(view);
    view[0].before!.position.x = 99;
    view[0].after!.position.y = 99;
    expect(JSON.stringify({ s, plan })).toBe(before);
    s.preparation.unlocked = [];
    expect(formationTargeting(s.preparation, planFormation(s.preparation, preset))).toBeNull();
    s.preparation.units[0].rank++;
    expect(formationTargeting(s.preparation, planFormation(s.preparation, preset))).toBeNull();
  });
});
