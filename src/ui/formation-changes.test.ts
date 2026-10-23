import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { captureFormation, planFormation } from '../game/formation-presets';
import { Session, type Unit } from '../game/session';
import { formationChanges, formationPositionLabel } from './formation-changes';

function prepared(units?: Unit[]): Session {
  const s = new Session();
  s.preparation.units = units ?? [
    { id: 10, kind: 'boar', rank: 2, position: { x: 0, y: 0 } },
    { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 0 } },
    { id: 12, kind: 'ice_fish', rank: 3, position: null },
  ];
  s.preparation.nextId = Math.max(...s.preparation.units.map((u) => u.id)) + 1;
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}

describe('阵型应用前站位变化', () => {
  it('换位、上阵、退备战各计一次，预览与实际应用一致且撤销还原', () => {
    const s = prepared();
    const preset = captureFormation(s.preparation.units);
    expect(s.swap(10, 12)).toBeNull();
    expect(s.transfer({ type: 'unit', id: 11 }, { x: 3, y: 0 })).toBeNull();
    const preparation = clone(s.preparation);
    const plan = planFormation(s.preparation, preset);
    const before = JSON.stringify({ s, preset, plan });
    const view = formationChanges(s.preparation.units, plan)!;
    expect(view).toEqual({
      moved: 1,
      deployed: 1,
      reserved: 1,
      units: [
        { id: 10, kind: 'boar', rank: 2, from: null, to: { x: 0, y: 0 } },
        { id: 11, kind: 'ember_mouse', rank: 1, from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
        { id: 12, kind: 'ice_fish', rank: 3, from: { x: 0, y: 0 }, to: null },
      ],
    });
    expect(JSON.stringify({ s, preset, plan })).toBe(before);
    expect(s.applyFormation(preset)).toBeNull();
    for (const unit of view.units)
      expect(s.preparation.units.find((u) => u.id === unit.id)!.position).toEqual(unit.to);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(preparation);
  });

  it('同种同阶按真实实例匹配，不依赖数组索引，未动者不列', () => {
    const s = prepared([
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 0 } },
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
      { id: 12, kind: 'ember_mouse', rank: 1, position: null },
    ]);
    const preset = captureFormation(s.preparation.units);
    s.swap(10, 11);
    const plan = planFormation(s.preparation, preset);
    // Presentation must follow IDs even if the successful plan's array order changes.
    if ('units' in plan) plan.units.reverse();
    expect(formationChanges(s.preparation.units, plan)).toEqual({
      moved: 2,
      deployed: 0,
      reserved: 0,
      units: [
        { id: 11, kind: 'ember_mouse', rank: 1, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { id: 10, kind: 'ember_mouse', rank: 1, from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
      ],
    });
  });

  it('无预设、无效、阵容不符、锁格、相同站位均不显示应用预览', () => {
    const s = prepared();
    const preset = captureFormation(s.preparation.units);
    expect(formationChanges(s.preparation.units, null)).toBeNull();
    expect(formationChanges(s.preparation.units, planFormation(s.preparation, {}))).toBeNull();
    expect(formationChanges(s.preparation.units, planFormation(s.preparation, preset))).toBeNull();
    s.preparation.units[0].rank++;
    expect(formationChanges(s.preparation.units, planFormation(s.preparation, preset))).toBeNull();
    s.preparation.units[0].rank--;
    s.preparation.unlocked = [];
    expect(formationChanges(s.preparation.units, planFormation(s.preparation, preset))).toBeNull();
  });

  it('满36格循环换位展示完整且起止位置不共享源对象', () => {
    const s = prepared(
      Array.from({ length: 36 }, (_, i) => ({
        id: i + 1,
        kind: 'ember_mouse',
        rank: 6,
        position: { x: i % 6, y: Math.floor(i / 6) },
      })),
    );
    const preset = captureFormation(s.preparation.units);
    preset.units.forEach((unit, i) => {
      unit.position = { x: (i + 1) % 6, y: Math.floor(((i + 1) % 36) / 6) };
    });
    const plan = planFormation(s.preparation, preset);
    const before = JSON.stringify({ s, plan });
    const view = formationChanges(s.preparation.units, plan)!;
    expect(view).toMatchObject({ moved: 36, deployed: 0, reserved: 0 });
    expect(view.units).toHaveLength(36);
    expect(view.units[35].to).toEqual({ x: 0, y: 0 });
    view.units[0].from!.x = 99;
    view.units[1].to!.y = 99;
    expect(JSON.stringify({ s, plan })).toBe(before);
  });

  it('坐标按1起算，备战席与第1列1行清楚区分', () => {
    expect(formationPositionLabel(null)).toBe('备战席');
    expect(formationPositionLabel({ x: 0, y: 0 })).toBe('1列1行');
    expect(formationPositionLabel({ x: 5, y: 5 })).toBe('6列6行');
  });
});
