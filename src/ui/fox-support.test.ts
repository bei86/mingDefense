import { describe, expect, it } from 'vitest';
import { cells, clone, heroIds, heroes, type HeroId } from '../game/content';
import { createCombat } from '../game/combat';
import { attackDamage, shieldTarget } from '../game/combat-skills';
import type { Unit } from '../game/model';
import { Session } from '../game/session';
import { foxSupport } from './fox-support';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}

function lineup(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  s.preparation.nextId = 100;
  return s;
}

describe('狐支援覆盖检查', () => {
  it('空阵/无狐/无输出与备战及招募来源明确区分', () => {
    const s = lineup([]);
    expect(foxSupport(s.preparation)).toEqual({
      foxCount: 0,
      auraFoxCount: 0,
      frontRow: null,
      frontCount: 0,
      shieldReachableCount: 0,
      shieldReachableFrontCount: 0,
      attackerCount: 0,
      auraAttackerCount: 0,
      units: [],
    });
    s.preparation.units = [
      unit(10, 'ember_mouse', 0, 0),
      { id: 20, kind: 'shield_fox', rank: 6, position: null },
      { id: 21, kind: 'ember_mouse', rank: 6, position: null },
    ];
    s.preparation.offers = [
      { id: 1, kind: 'shield_fox', rank: 6, claimed: false },
      { id: 2, kind: 'shield_fox', rank: 6, claimed: true },
    ];
    expect(foxSupport(s.preparation)).toMatchObject({
      foxCount: 0,
      frontRow: 0,
      frontCount: 1,
      attackerCount: 1,
      shieldReachableCount: 0,
      auraAttackerCount: 0,
      units: [{ id: 10, shieldSources: [], auraSources: [] }],
    });
    s.preparation.units = [unit(10, 'fortune_peach', 0, 0), unit(11, 'shield_fox', 1, 0)];
    expect(foxSupport(s.preparation)).toMatchObject({
      foxCount: 1,
      auraFoxCount: 0,
      attackerCount: 0,
      auraAttackerCount: 0,
      shieldReachableCount: 2,
      shieldReachableFrontCount: 2,
    });
  });

  it.each(heroIds)('%s按完整中心计算，施盾来源与真实shieldTarget逐目标一致', (kind) => {
    const s = lineup([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(11, kind, 1, 2),
      unit(12, 'shield_fox', 5, 5, 1),
    ]);
    s.preparation.progression.buffs.range = 2;
    const model = foxSupport(s.preparation);
    const battle = createCombat(s.preparation.units, { progression: s.preparation.progression });
    const reachable = new Set<number>();
    for (const source of battle.allies.filter((u) => u.kind === 'shield_fox')) {
      for (const target of battle.allies) {
        battle.allies.forEach((u) => {
          u.shield = u.maxHp;
        });
        target.shield = 0;
        const sources = model.units.find((u) => u.id === target.id)!.shieldSources;
        const selected = shieldTarget(battle, source)?.id === target.id;
        if (selected) reachable.add(target.id);
        expect(sources.some((u) => u.id === source.id)).toBe(selected);
      }
    }
    expect(model.shieldReachableCount).toBe(reachable.size);
    const target = model.units.find((u) => u.id === 11)!;
    expect(target.cells).toEqual(cells(kind, s.preparation.units[1].position!));
  });

  it('2.5格边界包含，中心超界不按最近占格覆盖，射程天赋只扩施盾', () => {
    const s = lineup([unit(10, 'shield_fox', 0, 0, 3), unit(11, 'boar', 1, 2)]);
    let target = foxSupport(s.preparation).units.find((u) => u.id === 11)!;
    expect(target.shieldSources.map((f) => f.id)).toEqual([10]);
    expect(target.auraSources.map((f) => f.id)).toEqual([10]);
    s.preparation.units[1].position = { x: 2, y: 1 };
    target = foxSupport(s.preparation).units.find((u) => u.id === 11)!;
    expect(target.shieldSources).toEqual([]);
    expect(target.auraSources).toEqual([]);
    s.preparation.progression.buffs.range = 3;
    target = foxSupport(s.preparation).units.find((u) => u.id === 11)!;
    expect(target.shieldSources.map((f) => f.id)).toEqual([10]);
    expect(target.auraSources).toEqual([]);
  });

  it.each(heroIds.filter((kind) => kind !== 'fortune_peach' && kind !== 'shield_fox'))(
    '%s光环来源与实际攻击加成一致，多狐不叠加且低阶无来源',
    (kind) => {
      const s = lineup([
        unit(10, 'shield_fox', 0, 1, 3),
        unit(11, 'shield_fox', 1, 0, 6),
        unit(12, 'shield_fox', 0, 2, 2),
        unit(13, kind, 1, 1, 3),
      ]);
      s.preparation.progression.buffs.attack = 2;
      const model = foxSupport(s.preparation);
      expect(model.auraFoxCount).toBe(2);
      expect(model.auraAttackerCount).toBe(1);
      expect(model.units.find((u) => u.id === 13)!.auraSources.map((f) => f.id)).toEqual([10, 11]);
      const battle = createCombat(s.preparation.units, { progression: s.preparation.progression });
      const target = battle.allies.find((u) => u.id === 13)!;
      const withoutFox = { ...battle, allies: [target] };
      expect(attackDamage(battle, target) - attackDamage(withoutFox, target)).toBeCloseTo(
        (heroes[kind].hitDamage[2] * heroes.shield_fox.skills.auraAttackPercent!) / 100,
      );
      for (const u of s.preparation.units.filter((u) => u.kind === 'shield_fox')) u.rank = 2;
      expect(foxSupport(s.preparation)).toMatchObject({ auraFoxCount: 0, auraAttackerCount: 0 });
    },
  );

  it('狐可给自身及桃施盾，桃狐不计输出光环，前排多格单位仅计一次', () => {
    const s = lineup([
      unit(10, 'shield_fox', 2, 1, 3),
      unit(11, 'fortune_peach', 3, 1),
      unit(12, 'ice_fish', 1, 0),
      unit(13, 'sword_eagle', 3, 2),
    ]);
    const model = foxSupport(s.preparation);
    expect(model).toMatchObject({
      frontRow: 0,
      frontCount: 1,
      shieldReachableFrontCount: 1,
      shieldReachableCount: 4,
      attackerCount: 2,
      auraAttackerCount: 2,
    });
    for (const id of [10, 11]) {
      const target = model.units.find((u) => u.id === id)!;
      expect(target.shieldSources.map((f) => f.id)).toEqual([10]);
      expect(target.auraSources).toEqual([]);
      expect(target.attacker).toBe(false);
    }
    expect(model.units.filter((u) => u.front).map((u) => u.id)).toEqual([12]);
  });

  it('按站位/编号排序，来源按编号排序，不修改输入对象或覆盖已有撤销', () => {
    const s = lineup([
      unit(14, 'shield_fox', 2, 1, 3),
      unit(11, 'ember_mouse', 1, 0),
      unit(12, 'shield_fox', 0, 0, 4),
      unit(10, 'boar', 2, 0),
    ]);
    expect(s.transfer({ type: 'unit', id: 14 }, { x: 1, y: 1 })).toBeNull();
    const before = clone(s.exportSave());
    const revision = s.revision;
    const model = foxSupport(s.preparation);
    expect(model.units.map((u) => u.id)).toEqual([12, 11, 10, 14]);
    expect(model.units.find((u) => u.id === 11)!.shieldSources.map((f) => f.id)).toEqual([12, 14]);
    model.units[0].position.x = 5;
    model.units[0].cells[0].y = 5;
    model.units[1].shieldSources[0].position.x = 4;
    model.units[1].auraSources[0].rank = 6;
    expect(s.exportSave()).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units.find((u) => u.id === 14)!.position).toEqual({ x: 2, y: 1 });
  });

  it('移动/换位/合成/撤销后重新计算覆盖与光环门槛', () => {
    const s = lineup([unit(10, 'shield_fox', 0, 0, 2), unit(11, 'ember_mouse', 5, 5)]);
    expect(foxSupport(s.preparation).shieldReachableCount).toBe(1);
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 4, y: 5 })).toBeNull();
    expect(foxSupport(s.preparation).shieldReachableCount).toBe(2);
    expect(s.undo()).toBeNull();
    expect(foxSupport(s.preparation).shieldReachableCount).toBe(1);
    s.preparation.units.push({ id: 12, kind: 'shield_fox', rank: 3, position: null });
    expect(s.swap(12, 11)).toBeNull();
    expect(foxSupport(s.preparation)).toMatchObject({ foxCount: 2, attackerCount: 0 });
    expect(s.undo()).toBeNull();
    expect(foxSupport(s.preparation)).toMatchObject({ foxCount: 1, attackerCount: 1 });
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 1, y: 0 })).toBeNull();
    expect(foxSupport(s.preparation).auraAttackerCount).toBe(0);
    s.preparation.offers = [{ id: 1, kind: 'shield_fox', rank: 2, claimed: false }];
    expect(s.transfer({ type: 'offer', id: 1 }, { merge: 10 })).toBeNull();
    expect(foxSupport(s.preparation).auraAttackerCount).toBe(1);
    expect(s.undo()).toBeNull();
    expect(foxSupport(s.preparation).auraAttackerCount).toBe(0);
  });
});
