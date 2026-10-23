import { describe, expect, it } from 'vitest';
import { clone } from './content';
import { captureFormation, planFormation, validFormation } from './formation-presets';
import { Session, type Unit } from './session';
import { validSave } from './persistence';

function prepared(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.nextId = Math.max(...units.map((unit) => unit.id)) + 1;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}
function pair(): Session {
  return prepared([
    { id: 10, kind: 'boar', rank: 2, position: { x: 0, y: 0 } },
    { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 0 } },
    { id: 12, kind: 'ice_fish', rank: 3, position: null },
  ]);
}

describe('阵型预设原子应用', () => {
  it('满36格可一次循环搬位，只改位置，撤销完整恢复且不触碰随机和资源', () => {
    const s = prepared(
      Array.from({ length: 36 }, (_, i) => ({
        id: i + 5,
        kind: 'ember_mouse',
        rank: 6,
        position: { x: i % 6, y: Math.floor(i / 6) },
      })),
    );
    const before = clone(s.preparation);
    const preset = captureFormation(s.preparation.units);
    preset.units.forEach((unit, i) => {
      unit.position = { x: (i + 1) % 6, y: Math.floor(((i + 1) % 36) / 6) };
    });
    expect(s.applyFormation(preset)).toBeNull();
    expect(s.revision).toBe(1);
    expect({ ...s.preparation, units: before.units }).toEqual(before);
    expect(s.preparation.units.map(({ position: _, ...unit }) => unit)).toEqual(
      before.units.map(({ position: _, ...unit }) => unit),
    );
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before);
  });

  it('保存不共享位置，同种同阶按实例ID稳定匹配，当前数组顺序不变', () => {
    const s = prepared([
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 0 } },
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
    ]);
    const preset = captureFormation(s.preparation.units);
    expect(preset.units[0].position).toEqual({ x: 0, y: 0 });
    s.swap(10, 11);
    expect(preset.units[0].position).toEqual({ x: 0, y: 0 });
    expect(s.applyFormation(preset)).toBeNull();
    expect(s.preparation.units.map((unit) => [unit.id, unit.position!.x])).toEqual([
      [11, 1],
      [10, 0],
    ]);
  });

  it('多格与满备战席按最终占格整体校验，可保存加载及开战回滚', () => {
    const s = pair();
    s.preparation.units.push({ id: 13, kind: 'shield_fox', rank: 1, position: null });
    s.preparation.nextId = 14;
    const preset = captureFormation(s.preparation.units);
    expect(s.swap(10, 12)).toBeNull();
    expect(s.applyFormation(preset)).toBeNull();
    const save = s.exportSave();
    expect(validSave(save)).toBe(true);
    const restored = Session.restore(save);
    expect(restored.preparation).toEqual(s.preparation);
    const before = clone(restored.preparation);
    restored.start();
    expect(restored.battle!.allies.map((unit) => unit.id)).toEqual([10, 11]);
    restored.tick();
    restored.backToPreparation();
    expect(restored.preparation).toEqual(before);
  });

  it.each(['kind', 'rank', 'added', 'removed'])(
    '阵容%s变化整笔拒绝，不创建/合成/删除灵兽',
    (change) => {
      const s = pair();
      const preset = captureFormation(s.preparation.units);
      if (change === 'kind') s.preparation.units[0].kind = 'ember_mouse';
      if (change === 'rank') s.preparation.units[0].rank++;
      if (change === 'added')
        s.preparation.units.push({ id: 99, kind: 'shield_fox', rank: 1, position: null });
      if (change === 'removed') s.preparation.units.pop();
      const before = JSON.stringify(s);
      expect(s.applyFormation(preset)).toContain('种类、阶数或数量');
      expect(JSON.stringify(s)).toBe(before);
    },
  );

  it('锁格、重叠、多格出界、3只备战及空阵拒绝，失败和同站位不清除原撤销', () => {
    const s = pair();
    const preset = captureFormation(s.preparation.units);
    s.transfer({ type: 'unit', id: 10 }, { x: 0, y: 1 });
    s.transfer({ type: 'unit', id: 11 }, { x: 3, y: 0 });
    s.preparation.unlocked = s.preparation.unlocked.filter((cell) => cell !== '1,0');
    const before = JSON.stringify(s);
    expect(s.applyFormation(preset)).toContain('完整解锁');
    expect(JSON.stringify(s)).toBe(before);
    expect(s.applyFormation(captureFormation(s.preparation.units))).toContain('当前已是');
    expect(JSON.stringify(s)).toBe(before);
    const bad = clone(preset);
    bad.units[0].position = { x: 5, y: 0 };
    expect(s.applyFormation(bad)).toContain('无效');
    bad.units[0].position = { x: 1, y: 0 };
    expect(s.applyFormation(bad)).toContain('无效');
    expect(
      validFormation({
        units: [
          ...preset.units.map((unit) => ({ ...unit, position: null })),
          { kind: 'ember_mouse', rank: 1, position: { x: 4, y: 4 } },
        ],
      }),
    ).toBe(false);
    expect(validFormation({ units: [] })).toBe(false);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units[1].position).toEqual({ x: 2, y: 0 });
  });

  it.each(['combat', 'victory', 'defeat'] as const)('%s阶段不能应用且不改状态', (phase) => {
    const s = pair();
    const preset = captureFormation(s.preparation.units);
    s.start();
    s.phase = phase;
    const before = JSON.stringify(s);
    expect(s.applyFormation(preset)).toContain('战斗期间');
    expect(JSON.stringify(s)).toBe(before);
  });

  it('不同拥有者ID只能重排当前阵容，预览无副作用', () => {
    const a = pair(),
      b = pair();
    const preset = captureFormation(a.preparation.units);
    b.preparation.units.forEach((unit) => {
      unit.id += 100;
    });
    b.preparation.nextId += 100;
    b.swap(110, 112);
    const before = clone(b.preparation);
    expect('units' in planFormation(b.preparation, preset)).toBe(true);
    expect(b.preparation).toEqual(before);
    expect(b.applyFormation(preset)).toBeNull();
    expect(b.preparation.units.map((unit) => unit.id)).toEqual([110, 111, 112]);
    expect(b.preparation.nextId).toBe(before.nextId);
  });
});
