import { describe, expect, it } from 'vitest';
import { type HeroId, type Point } from '../game/content';
import { captureFormation, planFormation } from '../game/formation-presets';
import { Session, type Unit } from '../game/session';
import { foxSupport } from './fox-support';
import { formationSupport } from './formation-support';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}
function prepared(units: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units;
  s.preparation.nextId = 100;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}
function presetAt(s: Session, positions: (Point | null)[]) {
  return captureFormation(s.preparation.units.map((u, i) => ({ ...u, position: positions[i] })));
}

describe('阵型狐支援对照', () => {
  it('复用真实计划，预览与应用相同，撤销恢复且读取不改变任何会话数据', () => {
    const s = prepared([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(20, 'ember_mouse', 1, 1),
      unit(30, 'boar', 3, 3),
    ]);
    const preset = presetAt(s, [
      { x: 4, y: 2 },
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ]);
    const plan = planFormation(s.preparation, preset);
    const snapshot = JSON.stringify({ s, plan, preset });
    const view = formationSupport(s.preparation, plan)!;
    expect(view.before).toEqual(foxSupport(s.preparation));
    expect(JSON.stringify({ s, plan, preset })).toBe(snapshot);
    expect(s.applyFormation(preset)).toBeNull();
    expect(view.after).toEqual(foxSupport(s.preparation));
    expect(formationSupport(s.preparation, planFormation(s.preparation, preset))).toBeNull();
    expect(s.undo()).toBeNull();
    expect(formationSupport(s.preparation, planFormation(s.preparation, preset))).toEqual(view);
  });

  it('总数相同但接收者互换仍列出得失，不把自身来源位置改变当作新增来源', () => {
    const s = prepared([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(20, 'ember_mouse', 1, 1),
      unit(30, 'ember_mouse', 4, 1, 2),
    ]);
    const preset = presetAt(s, [
      { x: 5, y: 0 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
    ]);
    const view = formationSupport(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.before.shieldReachableCount).toBe(view.after.shieldReachableCount);
    expect(view.before.auraAttackerCount).toBe(view.after.auraAttackerCount);
    expect(view.changes.map((c) => c.id)).toEqual([20, 30]);
    expect(view.changes[0].before!.shieldSources.map((f) => f.id)).toEqual([10]);
    expect(view.changes[0].after!.shieldSources).toEqual([]);
    expect(view.changes[1].after!.auraSources.map((f) => f.id)).toEqual([10]);
  });

  it('人数不变但来源狐替换仍显示，来源保留阶数编号和位置', () => {
    const s = prepared([
      unit(10, 'shield_fox', 0, 0, 3),
      unit(20, 'shield_fox', 5, 0, 4),
      unit(30, 'ember_mouse', 1, 1),
    ]);
    const preset = presetAt(s, [
      { x: 5, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    const view = formationSupport(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.before.auraAttackerCount).toBe(view.after.auraAttackerCount);
    const mouse = view.changes.find((c) => c.id === 30)!;
    expect(mouse.before!.auraSources).toEqual([{ id: 10, rank: 3, position: { x: 0, y: 0 } }]);
    expect(mouse.after!.auraSources).toEqual([{ id: 20, rank: 4, position: { x: 0, y: 0 } }]);
  });

  it('同种同阶实例依计划映射且不受当前数组顺序影响', () => {
    const s = prepared([
      unit(90, 'ember_mouse', 1, 1),
      unit(10, 'ember_mouse', 4, 1),
      unit(50, 'shield_fox', 0, 0, 3),
    ]);
    const preset = captureFormation(s.preparation.units);
    expect(s.swap(90, 10)).toBeNull();
    s.preparation.units.reverse();
    const plan = planFormation(s.preparation, preset);
    expect('units' in plan).toBe(true);
    if (!('units' in plan)) throw new Error('Expected valid plan');
    const view = formationSupport(s.preparation, plan)!;
    expect(view.changes.map((c) => c.id)).toEqual([10, 90]);
    for (const u of view.after.units)
      expect(u.position).toEqual(plan.units.find((planned) => planned.id === u.id)!.position);
    expect(view.after.units.find((u) => u.id === 90)!.shieldSources).toHaveLength(1);
  });

  it('上阵与备战双向变化明确，前排按多格起点且保留完整占格', () => {
    const s = prepared([
      unit(10, 'boar', 0, 0),
      { ...unit(20, 'shield_fox', 0, 0, 3), position: null },
      unit(30, 'fortune_peach', 5, 5),
    ]);
    const preset = presetAt(s, [null, { x: 4, y: 4 }, { x: 5, y: 5 }]);
    const view = formationSupport(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.before.frontRow).toBe(0);
    expect(view.after.frontRow).toBe(4);
    expect(view.changes.find((c) => c.id === 10)).toMatchObject({
      before: {
        cells: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        front: true,
      },
      after: null,
    });
    expect(view.changes.find((c) => c.id === 20)).toMatchObject({
      before: null,
      after: { front: true },
    });
    expect(view.after.attackerCount).toBe(0);
    expect(view.after.auraAttackerCount).toBe(0);
  });

  it('只改变前排归属也列出；同排仅位置变化不重复已有站位对照', () => {
    const s = prepared([unit(10, 'ember_mouse', 0, 0), unit(20, 'fortune_peach', 4, 1)]);
    const preset = presetAt(s, [
      { x: 2, y: 0 },
      { x: 4, y: 1 },
    ]);
    expect(formationSupport(s.preparation, planFormation(s.preparation, preset))!.changes).toEqual(
      [],
    );
    preset.units[0].position = { x: 2, y: 2 };
    expect(
      formationSupport(s.preparation, planFormation(s.preparation, preset))!.changes.map(
        (c) => c.id,
      ),
    ).toEqual([10, 20]);
  });

  it('当前空场可对照，无狐无输出使用真实零值而非虚构来源', () => {
    const s = prepared([{ ...unit(10, 'fortune_peach', 0, 0), position: null }]);
    const preset = presetAt(s, [{ x: 0, y: 0 }]);
    const view = formationSupport(s.preparation, planFormation(s.preparation, preset))!;
    expect(view.before.frontRow).toBeNull();
    expect(view.before.units).toEqual([]);
    expect(view.after).toMatchObject({ foxCount: 0, attackerCount: 0, shieldReachableCount: 0 });
    expect(view.changes[0]).toMatchObject({
      before: null,
      after: { shieldSources: [], auraSources: [] },
    });
  });

  it('无计划、同站位、无效预设、阵容不符与锁格均隐藏', () => {
    const s = prepared([unit(10, 'shield_fox', 0, 0)]);
    const preset = captureFormation(s.preparation.units);
    expect(formationSupport(s.preparation, null)).toBeNull();
    for (const p of [preset, {}, { units: [] }])
      expect(formationSupport(s.preparation, planFormation(s.preparation, p))).toBeNull();
    preset.units[0].position = { x: 5, y: 5 };
    s.preparation.unlocked = ['0,0'];
    expect(formationSupport(s.preparation, planFormation(s.preparation, preset))).toBeNull();
    s.preparation.units[0].rank = 2;
    expect(formationSupport(s.preparation, planFormation(s.preparation, preset))).toBeNull();
  });

  it('结果的占格与来源坐标隔离于当前会话和计划，重复读取一致', () => {
    const s = prepared([unit(10, 'shield_fox', 0, 0, 3), unit(20, 'boar', 1, 1)]);
    const preset = presetAt(s, [
      { x: 3, y: 1 },
      { x: 1, y: 1 },
    ]);
    const plan = planFormation(s.preparation, preset);
    const snapshot = JSON.stringify({ s, plan });
    const view = formationSupport(s.preparation, plan)!;
    expect(formationSupport(s.preparation, plan)).toEqual(view);
    for (const model of [view.before, view.after]) {
      model.units[0].position.x = 99;
      model.units[0].cells[0].y = 99;
      model.units[0].shieldSources[0].position.x = 99;
    }
    expect(JSON.stringify({ s, plan })).toBe(snapshot);
  });
});
