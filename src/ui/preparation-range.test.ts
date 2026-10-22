import { describe, expect, it } from 'vitest';
import { center, clone, heroIds, heroes, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { attackDamage, shieldTarget } from '../game/combat-skills';
import type { Unit } from '../game/model';
import { Session, type Preparation } from '../game/session';
import { preparationRange, rangeDescription } from './preparation-range';

function preparation(units: Unit[]): Preparation {
  const p = new Session().preparation;
  p.units = units;
  p.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return p;
}
function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}

describe('布阵范围预览', () => {
  it.each(heroIds.filter((kind) => !['fortune_peach', 'shield_fox'].includes(kind)))(
    '%s射程与实战寻敌边界一致，含射程天赋',
    (kind) => {
      const p = preparation([unit(10, kind, 1, 3)]);
      p.progression.buffs.range = 2;
      const preview = preparationRange(p, { type: 'unit', id: 10 }, null, null, 6)!;
      expect(preview.point).toEqual(center(kind, p.units[0].position!));
      const range = preview.circles[0];
      expect(range.kind).toBe('attack');
      for (const [extra, acquired] of [
        [0, true],
        [0.0001, false],
      ] as const) {
        const battle = createCombat(p.units, { progression: p.progression });
        battle.spawns = [];
        battle.enemies = [
          {
            id: 99,
            kind: 'wolf',
            x: preview.point!.x,
            y: preview.point!.y - range.radius - extra,
            hp: 100000,
            cooldown: 100000,
            target: null,
            recheckAt: 0,
            frozenUntil: 100000,
          },
        ];
        stepCombat(battle);
        expect(battle.allies[0].ordinal > 0).toBe(acquired);
      }
    },
  );

  it('施盾覆盖与实战目标选择一致，光环固定半径与攻击加成一致', () => {
    const p = preparation([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(11, 'boar', 1, 2), // Center is exactly 2.5 cells away.
      unit(12, 'ember_mouse', 3, 0),
      unit(13, 'sword_eagle', 4, 4),
    ]);
    p.progression.buffs.range = 3;
    const before = clone(p);
    const preview = preparationRange(p, { type: 'unit', id: 10 }, null, null, 6)!;
    const battle = createCombat(p.units, { progression: p.progression });
    const source = battle.allies[0];
    for (const ally of battle.allies.slice(1)) {
      battle.allies.forEach((u) => {
        u.shield = u.maxHp;
      });
      ally.shield = 0;
      const covered = preview.covered.find((u) => u.id === ally.id);
      expect(shieldTarget(battle, source)?.id === ally.id).toBe(covered?.shield ?? false);
      expect(attackDamage(battle, ally) > heroes[ally.kind].hitDamage[ally.rank - 1]).toBe(
        covered?.aura ?? false,
      );
    }
    expect(preview.circles.find((c) => c.kind === 'aura')!.radius).toBe(
      heroes.shield_fox.skills.auraRadiusCells,
    );
    expect(preview.covered.find((u) => u.id === 11)?.aura).toBe(true);
    expect(preview.covered.find((u) => u.id === 12)).toMatchObject({ shield: true, aura: false });
    expect(p).toEqual(before);
  });

  it('二阶狐无光环，同阶合成预览三阶光环，移除消耗源与目标的旧计数', () => {
    const p = preparation([
      unit(10, 'shield_fox', 0, 0, 2),
      unit(11, 'shield_fox', 3, 3, 2),
      unit(12, 'ember_mouse', 4, 3),
    ]);
    expect(
      preparationRange(p, { type: 'unit', id: 10 }, null, null, 6)!.circles.map((c) => c.kind),
    ).toEqual(['shield']);
    const before = clone(p);
    const preview = preparationRange(p, { type: 'unit', id: 10 }, { x: 3, y: 3 }, null, 6)!;
    expect(preview).toMatchObject({ rank: 3, status: 'merge', point: { x: 3.5, y: 3.5 } });
    expect(preview.circles.map((c) => c.kind)).toEqual(['shield', 'aura']);
    expect(preview.covered.map((u) => u.id)).toEqual([12]);
    expect(p).toEqual(before);
    const s = new Session();
    s.preparation = clone(p);
    expect(s.transfer({ type: 'unit', id: 10 }, { merge: 11 })).toBeNull();
    expect(s.preparation.units.find((u) => u.id === 11)).toMatchObject({
      rank: preview.rank,
      position: { x: 3, y: 3 },
    });
  });

  it('点选多格自身非锚点保持真实中心，拖动时应用抓取偏移', () => {
    const p = preparation([unit(10, 'sword_eagle', 1, 3)]);
    expect(preparationRange(p, { type: 'unit', id: 10 }, { x: 2, y: 4 }, null, 6)!.point).toEqual({
      x: 2,
      y: 4,
    });
    const preview = preparationRange(
      p,
      { type: 'unit', id: 10 },
      { x: 3, y: 4 },
      { x: 1, y: 1 },
      6,
    )!;
    expect(preview.point).toEqual({ x: 3, y: 4 });
    expect(preview.status).toBe('placement');
    const s = new Session();
    s.preparation = clone(p);
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 2, y: 3 })).toBeNull();
    expect(center('sword_eagle', s.preparation.units[0].position!)).toEqual(preview.point);
  });

  it('移动狐时不把源的旧位置算作伙伴，备战席不计覆盖', () => {
    const p = preparation([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(11, 'ember_mouse', 4, 3),
      { id: 12, kind: 'ember_mouse', rank: 2, position: null },
    ]);
    const preview = preparationRange(p, { type: 'unit', id: 10 }, { x: 3, y: 3 }, null, 6)!;
    expect(preview.covered.map((u) => u.id)).toEqual([11]);
  });

  it('招募与备战席在未指定位置时不画圈，放置前不领取招募', () => {
    const p = preparation([{ id: 10, kind: 'shield_fox', rank: 1, position: null }]);
    const before = clone(p);
    expect(preparationRange(p, { type: 'unit', id: 10 }, null, null, 6)).toMatchObject({
      status: 'unplaced',
      circles: [],
    });
    expect(preparationRange(p, { type: 'offer', id: 1 }, null, null, 6)).toMatchObject({
      status: 'unplaced',
      circles: [],
    });
    expect(preparationRange(p, { type: 'offer', id: 1 }, { x: 1, y: 3 }, null, 6)!.point).toEqual({
      x: 1.5,
      y: 3.5,
    });
    expect(p).toEqual(before);
  });

  it('越界、锁格、异种或满阶合成均不显示范围且不改状态', () => {
    const p = preparation([
      unit(10, 'boar', 1, 3),
      unit(11, 'ember_mouse', 3, 3),
      unit(12, 'boar', 1, 4, 6),
      unit(13, 'boar', 3, 4, 6),
    ]);
    p.unlocked = p.unlocked.filter((key) => key !== '1,0');
    const before = clone(p);
    for (const [id, point] of [
      [10, { x: 5, y: 3 }],
      [10, { x: 1, y: 0 }],
      [10, { x: 3, y: 3 }],
      [12, { x: 3, y: 4 }],
    ] as const) {
      const preview = preparationRange(p, { type: 'unit', id }, point, null, 6)!;
      expect(preview).toMatchObject({ status: 'invalid', point: null, circles: [] });
      expect(rangeDescription(preview)).toContain('范围未显示');
    }
    expect(p).toEqual(before);
  });

  it('桃不展示攻击圈，失效选择、扩地令和已领取招募不展示范围', () => {
    const p = preparation([unit(10, 'fortune_peach', 1, 3)]);
    const preview = preparationRange(p, { type: 'unit', id: 10 }, null, null, 6)!;
    expect(preview.circles).toEqual([]);
    expect(rangeDescription(preview)).toContain('定时产钱');
    p.offers.push({ id: 80, kind: 'cell', claimed: false });
    p.offers[0].claimed = true;
    for (const source of [
      null,
      { type: 'unit', id: 99 },
      { type: 'offer', id: 80 },
      { type: 'offer', id: 1 },
    ] as const)
      expect(preparationRange(p, source, { x: 1, y: 3 }, null, 6)).toBeNull();
  });
});
