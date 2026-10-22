import { describe, expect, it } from 'vitest';
import { clone, heroIds, type HeroId } from './content';
import { Session, swapError, type Unit } from './session';
import { validSave } from './persistence';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}
function session(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  s.preparation.nextId = Math.max(...units.map((u) => u.id)) + 1;
  return s;
}
function unchangedExceptPositions(before: Unit[], after: Unit[]): void {
  expect(after.map(({ position: _, ...u }) => u)).toEqual(before.map(({ position: _, ...u }) => u));
}

describe('整备原子换位', () => {
  it('36格全满时同种同阶仍只交换身份，成功可撤销且经济和随机数不变', () => {
    const s = session(
      Array.from({ length: 36 }, (_, i) => unit(i + 5, 'ember_mouse', i % 6, Math.floor(i / 6), 6)),
    );
    const before = clone(s.preparation);
    expect(s.swap(5, 40)).toBeNull();
    expect(s.revision).toBe(1);
    expect(s.preparation.units[0].position).toEqual({ x: 5, y: 5 });
    expect(s.preparation.units[35].position).toEqual({ x: 0, y: 0 });
    unchangedExceptPositions(before.units, s.preparation.units);
    expect({ ...s.preparation, units: before.units }).toEqual(before);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(s.canUndo).toBe(false);
  });

  it.each(heroIds)('%s与单格灵兽交换，检查整片形状，预览不改状态', (kind) => {
    const s = session([unit(10, kind, 0, 0, 3), unit(11, 'ember_mouse', 3, 3)]);
    const before = clone(s.preparation);
    expect(swapError(s.preparation, 10, 11)).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(0);
    expect(s.canUndo).toBe(false);
    expect(s.swap(10, 11)).toBeNull();
    expect(s.preparation.units.map((u) => u.position)).toEqual([
      { x: 3, y: 3 },
      { x: 0, y: 0 },
    ]);
    unchangedExceptPositions(before.units, s.preparation.units);
  });

  it.each([false, true])('满备战席与棋盘双向互换（反向=%s），不占第三席', (reverse) => {
    const s = session([
      unit(10, 'sword_eagle', 0, 0),
      { ...unit(11, 'ice_fish', 0, 0), position: null },
      { ...unit(12, 'boar', 0, 0), position: null },
    ]);
    const before = clone(s.preparation);
    expect(s.swap(reverse ? 11 : 10, reverse ? 10 : 11)).toBeNull();
    expect(s.preparation.units.map((u) => u.position)).toEqual([null, { x: 0, y: 0 }, null]);
    expect(s.preparation.units.filter((u) => !u.position)).toHaveLength(2);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before);
  });

  it.each([
    [unit(10, 'boar', 0, 0), unit(11, 'ember_mouse', 5, 5)],
    [unit(10, 'ember_mouse', 5, 5), unit(11, 'ice_fish', 0, 0)],
    [unit(10, 'boar', 0, 0), unit(11, 'ember_mouse', 3, 3), unit(12, 'ember_mouse', 4, 3)],
    [unit(10, 'ember_mouse', 3, 3), unit(11, 'boar', 0, 0), unit(12, 'ember_mouse', 4, 3)],
    [unit(10, 'boar', 1, 0), unit(11, 'ice_fish', 0, 1)], // New shapes overlap at (1,1).
  ])('越界、第三方阻挡或双方新占格交叠时整笔拒绝 %#', (...units) => {
    const s = session(units);
    const before = clone(s.preparation);
    expect(swapError(s.preparation, 10, 11)).toBeTruthy();
    expect(s.swap(10, 11)).toBeTruthy();
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(0);
    expect(s.canUndo).toBe(false);
  });

  it('新形状伸入锁格时拒绝；失败仍保留之前的移动撤销', () => {
    const s = session([unit(10, 'boar', 0, 0), unit(11, 'ember_mouse', 3, 3)]);
    s.preparation.unlocked = s.preparation.unlocked.filter((k) => k !== '4,3');
    const original = clone(s.preparation);
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 3, y: 4 })).toBeNull();
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 3, y: 3 })).toBeNull();
    const before = clone(s.preparation);
    expect(s.swap(10, 11)).toBeTruthy();
    expect(s.revision).toBe(2);
    expect(s.preparation).toEqual(before);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units[1].position).toEqual({ x: 3, y: 4 });
    expect(s.preparation.unlocked).toEqual(original.unlocked);
  });

  it('自身、失效ID、未领取招募及两个备战席不能交换', () => {
    const s = session([
      unit(10, 'boar', 0, 0),
      { ...unit(11, 'ice_fish', 0, 0), position: null },
      { ...unit(12, 'ember_mouse', 0, 0), position: null },
    ]);
    const before = clone(s.preparation);
    for (const [a, b] of [
      [10, 10],
      [10, 999],
      [999, 10],
      [1, 10],
      [11, 12],
    ]) {
      expect(s.swap(a, b)).toBeTruthy();
      expect(s.preparation).toEqual(before);
      expect(s.revision).toBe(0);
    }
  });

  it('合法换位可保存加载并以新位置开战；战斗及结果阶段拒绝换位', () => {
    const s = session([unit(10, 'boar', 0, 0), unit(11, 'shield_fox', 3, 3)]);
    expect(s.swap(10, 11)).toBeNull();
    const save = s.exportSave();
    expect(validSave(save)).toBe(true);
    const restored = Session.restore(save);
    expect(restored.preparation).toEqual(s.preparation);
    expect(restored.start()).toBeNull();
    expect(restored.battle!.allies.map((u) => u.position)).toEqual(
      s.preparation.units.map((u) => u.position),
    );
    for (const phase of ['combat', 'victory', 'defeat'] as const) {
      restored.phase = phase;
      const before = clone(restored.preparation);
      const revision = restored.revision;
      expect(restored.swap(10, 11)).toBeTruthy();
      expect(restored.preparation).toEqual(before);
      expect(restored.revision).toBe(revision);
    }
  });
});
