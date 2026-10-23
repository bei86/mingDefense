import { describe, expect, it } from 'vitest';
import { cells, clone, heroIds } from '../game/content';
import { Session } from '../game/session';
import { reserveUpgrades } from './reserve-upgrades';

function fullBoard(): Session {
  const s = new Session();
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  s.preparation.offers.forEach((offer) => {
    offer.claimed = true;
  });
  s.preparation.nextId = 30;
  return s;
}

describe('同种高阶备战提示', () => {
  it.each(heroIds)('%s完整占格与真实满备战换位一致，只列严格低阶上阵目标', (kind) => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 11, kind, rank: 1, position: { x: 0, y: 0 } },
      { id: 12, kind, rank: 3, position: { x: 3, y: 3 } },
      { id: 13, kind, rank: 6, position: { x: 0, y: 3 } },
      { id: 20, kind, rank: 4, position: null },
      { id: 21, kind, rank: 1, position: null },
    ];
    const before = clone(s.exportSave());
    const result = reserveUpgrades(s.preparation);
    expect(result).toHaveLength(1);
    expect(result[0].reserve).toEqual({ id: 20, kind, rank: 4 });
    expect(result[0].targets.map((target) => target.id)).toEqual([11, 12]);
    for (const target of result[0].targets) {
      expect(target.cells).toEqual(cells(kind, target.position));
      const trial = Session.restore(before);
      expect(trial.swap(20, target.id)).toBeNull();
      expect(trial.preparation.units.find((u) => u.id === 20)!.position).toEqual(target.position);
      expect(trial.undo()).toBeNull();
      expect(trial.exportSave()).toEqual(before);
    }
    expect(s.exportSave()).toEqual(before);
    expect(s.revision).toBe(0);
    expect(s.canUndo).toBe(false);
  });

  it('招募、不同种、同阶、高阶上阵及备战目标均不提示', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 11, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
      { id: 12, kind: 'shield_fox', rank: 1, position: { x: 1, y: 0 } },
      { id: 20, kind: 'ember_mouse', rank: 3, position: null },
      { id: 21, kind: 'ember_mouse', rank: 1, position: null },
    ];
    s.preparation.offers = [{ id: 1, kind: 'ember_mouse', rank: 6, claimed: false }];
    expect(reserveUpgrades(s.preparation)).toEqual([]);
    s.preparation.units[0].rank = 6;
    expect(reserveUpgrades(s.preparation)).toEqual([]);
    expect(reserveUpgrades(new Session().preparation)).toEqual([]);
    s.preparation.units = s.preparation.units.filter((u) => u.position);
    expect(reserveUpgrades(s.preparation)).toEqual([]);
  });

  it('来源按阶数降序与ID排序，目标按阶数及ID排序，共享目标仍是独立换位候选', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 12, kind: 'ember_mouse', rank: 2, position: { x: 0, y: 0 } },
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 0 } },
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 0 } },
      { id: 21, kind: 'ember_mouse', rank: 3, position: null },
      { id: 20, kind: 'ember_mouse', rank: 4, position: null },
    ];
    let result = reserveUpgrades(s.preparation);
    expect(result.map((r) => r.reserve.id)).toEqual([20, 21]);
    expect(result.map((r) => r.targets.map((t) => t.id))).toEqual([
      [10, 11, 12],
      [10, 11, 12],
    ]);
    s.preparation.units[4].rank = 3;
    result = reserveUpgrades(s.preparation);
    expect(result.map((r) => r.reserve.id)).toEqual([20, 21]);
  });

  it('未完整解锁的多格位置不提示，复用真实换位校验', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 11, kind: 'sword_eagle', rank: 1, position: { x: 0, y: 0 } },
      { id: 20, kind: 'sword_eagle', rank: 3, position: null },
    ];
    s.preparation.unlocked = ['0,0', '1,0', '0,1'];
    expect(reserveUpgrades(s.preparation)).toEqual([]);
    s.preparation.unlocked.push('1,1');
    expect(reserveUpgrades(s.preparation)).toHaveLength(1);
  });

  it('结果不保留原对象引用，读取不消耗资源或覆盖既有撤销', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
      { id: 20, kind: 'ember_mouse', rank: 3, position: null },
    ];
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 1, y: 0 })).toBeNull();
    const before = clone(s.exportSave());
    const revision = s.revision;
    const result = reserveUpgrades(s.preparation);
    result[0].targets[0].position.x = 5;
    result[0].targets[0].cells[0].x = 4;
    result[0].reserve.rank = 6;
    expect(s.exportSave()).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units[0].position).toEqual({ x: 0, y: 0 });
  });

  it('换位后候选消失，撤销恢复；合成或移动后立即反映最新阵容', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
      { id: 20, kind: 'ember_mouse', rank: 3, position: null },
    ];
    expect(reserveUpgrades(s.preparation)).toHaveLength(1);
    expect(s.swap(20, 11)).toBeNull();
    expect(reserveUpgrades(s.preparation)).toEqual([]);
    expect(s.undo()).toBeNull();
    expect(reserveUpgrades(s.preparation)[0].targets[0].position).toEqual({ x: 0, y: 0 });
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 2, y: 0 })).toBeNull();
    expect(reserveUpgrades(s.preparation)[0].targets[0].position).toEqual({ x: 2, y: 0 });
    s.preparation.offers = [{ id: 1, kind: 'ember_mouse', rank: 1, claimed: false }];
    expect(s.transfer({ type: 'offer', id: 1 }, { merge: 11 })).toBeNull();
    expect(reserveUpgrades(s.preparation)[0].targets[0].rank).toBe(2);
    s.preparation.offers = [{ id: 2, kind: 'ember_mouse', rank: 2, claimed: false }];
    expect(s.transfer({ type: 'offer', id: 2 }, { merge: 11 })).toBeNull();
    expect(reserveUpgrades(s.preparation)).toEqual([]);
  });
});
