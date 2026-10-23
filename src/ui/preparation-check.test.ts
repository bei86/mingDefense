import { describe, expect, it } from 'vitest';
import { clone, heroIds, type HeroId } from '../game/content';
import { Session, type Source } from '../game/session';
import { preparationCheck } from './preparation-check';

function fullBoard() {
  const s = new Session();
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}

describe('战前检查', () => {
  it('首战只列四张待领招募，固定完整落点数量，无参战生命或输出', () => {
    const s = new Session();
    const before = clone(s.preparation);
    const result = preparationCheck(s.preparation, s.maxRank);
    expect(result).toMatchObject({
      deployedCount: 0,
      attackerCount: 0,
      deployedHp: 0,
      emptyCells: 12,
    });
    expect(result.items.map((item) => item.placements)).toEqual([12, 12, 9, 6]);
    expect(result.items.map((item) => item.mergeTargets)).toEqual([0, 0, 0, 0]);
    expect(result.items.every((item) => item.origin === 'offer' && item.rank === 1)).toBe(true);
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(0);
    expect(s.canUndo).toBe(false);
  });

  it.each(heroIds)('%s的待领和备战落点数量均与真实transfer成功次数一致', (kind) => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 20, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 2 } },
      { id: 21, kind: 'ember_mouse', rank: 1, position: { x: 4, y: 4 } },
    ];
    s.preparation.offers = [{ id: 1, kind, rank: 2, claimed: false }];
    s.preparation.nextId = 22;
    for (const origin of ['offer', 'reserve'] as const) {
      if (origin === 'reserve') {
        expect(s.transfer({ type: 'offer', id: 1 }, 'reserve')).toBeNull();
      }
      const source: Source = {
        type: origin === 'offer' ? 'offer' : 'unit',
        id: origin === 'offer' ? 1 : 22,
      };
      let accepted = 0;
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          const trial = new Session();
          trial.preparation = clone(s.preparation);
          if (trial.transfer(source, { x, y }) === null) accepted++;
        }
      }
      const before = clone(s.preparation);
      const revision = s.revision;
      const item = preparationCheck(s.preparation, s.maxRank).items[0];
      expect(item).toMatchObject({ source, origin, kind, rank: 2, placements: accepted });
      expect(accepted).toBeGreaterThan(0);
      expect(s.preparation).toEqual(before);
      expect(s.revision).toBe(revision);
    }
  });

  it('桃狐不计输出，备战与招募不计参战生命；生命天赋与真实开战一致', () => {
    const s = fullBoard();
    s.preparation.progression.buffs.health = 2;
    s.preparation.units = [
      { id: 10, kind: 'fortune_peach', rank: 3, position: { x: 0, y: 0 } },
      { id: 11, kind: 'shield_fox', rank: 5, position: { x: 1, y: 0 } },
      { id: 12, kind: 'ember_mouse', rank: 6, position: null },
    ];
    const check = preparationCheck(s.preparation, s.maxRank);
    expect(check).toMatchObject({ deployedCount: 2, attackerCount: 0, emptyCells: 34 });
    expect(check.items[0]).toMatchObject({ origin: 'reserve', source: { type: 'unit', id: 12 } });
    expect(s.start()).toBeNull();
    expect(check.deployedHp).toBe(s.battle!.allies.reduce((sum, unit) => sum + unit.maxHp, 0));
    expect(s.battle!.allies).toHaveLength(2);
  });

  it.each(heroIds.filter((kind) => !['fortune_peach', 'shield_fox'].includes(kind)))(
    '%s上阵计入输出但不会把备战副本计入',
    (kind) => {
      const s = fullBoard();
      s.preparation.units = [
        { id: 10, kind, rank: 1, position: { x: 0, y: 0 } },
        { id: 11, kind, rank: 6, position: null },
      ];
      expect(preparationCheck(s.preparation, s.maxRank)).toMatchObject({
        deployedCount: 1,
        attackerCount: 1,
      });
    },
  );

  it('碎片空格即使数量足够，也不能放下多格灵兽', () => {
    const s = new Session();
    s.preparation.unlocked = ['0,0', '2,0', '4,0', '1,2', '3,2', '5,2'];
    s.preparation.offers = (
      ['boar', 'sword_eagle', 'ice_fish', 'piercing_monkey', 'scatter_bear'] as HeroId[]
    ).map((kind, i) => ({ id: i + 1, kind, claimed: false }));
    const check = preparationCheck(s.preparation, s.maxRank);
    expect(check.emptyCells).toBe(6);
    expect(check.items.map((item) => item.placements)).toEqual([0, 0, 0, 0, 0]);
  });

  it('满棋盘及满备战仍可从招募直接合成，不误判为能直接上阵', () => {
    const s = fullBoard();
    s.preparation.units = s.preparation.unlocked.map((_, i) => ({
      id: i + 10,
      kind: 'ember_mouse',
      rank: i === 0 ? 1 : 2,
      position: { x: i % 6, y: Math.floor(i / 6) },
    }));
    s.preparation.units.push(
      { id: 46, kind: 'shield_fox', rank: 1, position: null },
      { id: 47, kind: 'boar', rank: 1, position: null },
    );
    s.preparation.nextId = 48;
    const check = preparationCheck(s.preparation, s.maxRank);
    expect(check.emptyCells).toBe(0);
    expect(
      check.items.find((item) => item.source.type === 'offer' && item.source.id === 1),
    ).toMatchObject({ placements: 0, mergeTargets: 1 });
    expect(s.transfer({ type: 'offer', id: 1 }, { merge: 10 })).toBeNull();
    expect(s.preparation.units).toHaveLength(38);
  });

  it('候选排除自身、已领取招募、未领取目标、不同种阶与最高阶', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 10, kind: 'ember_mouse', rank: 2, position: { x: 0, y: 0 } },
      { id: 11, kind: 'ember_mouse', rank: 2, position: null },
      { id: 12, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 0 } },
      { id: 13, kind: 'shield_fox', rank: 2, position: { x: 2, y: 0 } },
    ];
    s.preparation.offers = [
      { id: 1, kind: 'ember_mouse', rank: 2, claimed: false },
      { id: 2, kind: 'ember_mouse', rank: 2, claimed: false },
      { id: 3, kind: 'ember_mouse', rank: 2, claimed: true },
    ];
    expect(
      preparationCheck(s.preparation, s.maxRank).items.map((item) => item.mergeTargets),
    ).toEqual([1, 2, 2]);
    for (const cap of [3, 6]) {
      s.preparation.units.forEach((unit) => {
        unit.rank = cap;
      });
      s.preparation.offers.forEach((offer) => {
        offer.rank = cap;
      });
      expect(preparationCheck(s.preparation, cap).items.map((item) => item.mergeTargets)).toEqual([
        0, 0, 0,
      ]);
    }
  });

  it('扩地只计边相邻合法位置，实际expand一致；全解锁无扩地位置', () => {
    const s = new Session();
    s.preparation.offers = [{ id: 1, kind: 'cell', claimed: false }];
    const check = preparationCheck(s.preparation, s.maxRank);
    // Initial rectangle touches the bottom: four above and three on either side.
    expect(check.items[0]).toMatchObject({
      kind: 'cell',
      rank: null,
      placements: 10,
      mergeTargets: 0,
    });
    let accepted = 0;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const trial = new Session();
        trial.preparation = clone(s.preparation);
        if (trial.expand(1, { x, y }) === null) accepted++;
      }
    }
    expect(check.items[0].placements).toBe(accepted);
    s.preparation.unlocked = fullBoard().preparation.unlocked;
    expect(preparationCheck(s.preparation, s.maxRank).items[0].placements).toBe(0);
    s.preparation.offers[0].claimed = true;
    expect(preparationCheck(s.preparation, s.maxRank).items).toEqual([]);
  });

  it('读取保留原撤销；真实部署/合成/撤销后统计即时改变且不持有过期数据', () => {
    const s = new Session();
    const initial = clone(s.preparation);
    s.transfer({ type: 'offer', id: 1 }, 'reserve');
    const afterReserve = clone(s.preparation);
    const revision = s.revision;
    const check = preparationCheck(s.preparation, s.maxRank);
    expect(check).toMatchObject({
      deployedCount: 0,
      attackerCount: 0,
      deployedHp: 0,
      emptyCells: 12,
    });
    expect(check.items).toHaveLength(4);
    expect(s.canUndo).toBe(true);
    expect(s.revision).toBe(revision);
    expect(s.preparation).toEqual(afterReserve);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(initial);

    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    const deployed = clone(s.preparation);
    expect(preparationCheck(s.preparation, s.maxRank)).toMatchObject({
      deployedCount: 1,
      attackerCount: 1,
      deployedHp: 120,
      emptyCells: 11,
    });
    s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id });
    expect(preparationCheck(s.preparation, s.maxRank)).toMatchObject({
      deployedCount: 1,
      deployedHp: 204,
      emptyCells: 11,
    });
    expect(preparationCheck(s.preparation, s.maxRank).items).toHaveLength(2);
    s.undo();
    expect(s.preparation).toEqual(deployed);
    expect(preparationCheck(s.preparation, s.maxRank).items).toHaveLength(3);
    expect(check).toMatchObject({ deployedCount: 0, deployedHp: 0 });
  });
});
