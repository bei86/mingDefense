import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import { cells, clone } from '../game/content';
import { validSave } from '../game/persistence';
import { Session } from '../game/session';
import { battleFormation } from './battle-formation';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';

function defeated() {
  const s = new Session(20261016);
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  s.transfer({ type: 'offer', id: 2 }, { x: 2, y: 3 });
  s.start();
  for (let i = 0; i < 10000 && (s.phase === 'combat' || s.hasChoices); i++) {
    if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
    else s.tick();
  }
  expect(s.phase).toBe('defeat');
  return s;
}

describe('战后阵型复盘投影', () => {
  it('未开战、未结束不能作为战后复盘', () => {
    expect(battleFormation(null, 'end')).toBeNull();
    expect(battleFormation(createCombat([]), 'start')).toBeNull();
  });

  it('真实双鼠全灭：开战、首批后、结束分步映射并保持同种实例位置', () => {
    const s = defeated();
    const b = s.battle!;
    expect(b.report!.falls).toEqual([
      { at: 22650, unitIds: [6] },
      { at: 24500, unitIds: [5] },
    ]);
    const before = clone(s);
    const start = battleFormation(b, 'start')!;
    expect(start.standing).toBe(2);
    expect(start.fallen).toBe(0);
    expect(start.units.map((u) => u.state)).toEqual(['standing', 'standing']);
    const first = battleFormation(b, 'fall-0')!;
    expect(first.selected.at).toBe(22650);
    expect(first.selected.label).toContain('第1批重伤后');
    expect(first.standing).toBe(1);
    expect(first.fallen).toBe(1);
    expect(first.units.find((u) => u.id === 6)).toMatchObject({
      state: 'newly-fallen',
      label: '烬灵鼠 1阶（3列4行）',
      position: { x: 2, y: 3 },
    });
    const second = battleFormation(b, 'fall-1')!;
    expect(second.units.find((u) => u.id === 6)?.state).toBe('fallen');
    expect(second.units.find((u) => u.id === 5)?.state).toBe('newly-fallen');
    const end = battleFormation(b, 'end')!;
    expect(end.standing).toBe(0);
    expect(end.fallen).toBe(2);
    expect(end.units.map((u) => u.state)).toEqual(['fallen', 'fallen']);
    expect(end.selected.at).toBe(b.time);
    expect(end.moments.map((m) => m.key)).toEqual(['start', 'fall-0', 'fall-1', 'end']);
    expect(s).toEqual(before);
  });

  it('同批同时变为本批重伤，不以ID或行列制造批内顺序', () => {
    const b = defeated().battle!;
    b.report!.falls = [{ at: b.time, unitIds: [6, 5] }];
    const view = battleFormation(b, 'fall-0')!;
    expect(view.units.map((u) => u.state)).toEqual(['newly-fallen', 'newly-fallen']);
    expect(view.standing).toBe(0);
    expect(view.fallen).toBe(2);
    expect(view.moments).toHaveLength(3);
  });

  it('八灵完整占格与终局真实状态独立，返回对象修改不污染来源', () => {
    const s = rosterPlaytest();
    s.start();
    for (let i = 0; i < 10000 && (s.phase === 'combat' || s.hasChoices); i++) {
      if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
      else s.tick();
    }
    expect(s.phase).toBe('victory');
    const b = s.battle!;
    const before = clone(b);
    const view = battleFormation(b, 'end')!;
    expect(view.units).toHaveLength(8);
    for (const unit of view.units) {
      const footprint = cells(unit.kind, unit.position);
      expect(unit.width * unit.height).toBe(footprint.length);
      expect(
        footprint.every(
          (p) =>
            p.x >= unit.position.x &&
            p.x < unit.position.x + unit.width &&
            p.y >= unit.position.y &&
            p.y < unit.position.y + unit.height,
        ),
      ).toBe(true);
      expect(unit.state).toBe(
        b.allies.find((ally) => ally.id === unit.id)!.hp > 0 ? 'standing' : 'fallen',
      );
    }
    view.units[0].position.x = 5;
    view.selected.label = '修改本地视图';
    expect(b).toEqual(before);
  });

  it('旧记录仅终局，缺逐兽报告仍可从实际结束生命展示，不猜历史', () => {
    const b = defeated().battle!;
    delete b.report!.falls;
    let view = battleFormation(b, 'start')!;
    expect(view.historyRecorded).toBe(false);
    expect(view.moments.map((m) => m.key)).toEqual(['end']);
    expect(view.selected.key).toBe('end');
    expect(view.fallen).toBe(2);
    delete b.report;
    view = battleFormation(b, 'fall-0')!;
    expect(view.moments).toHaveLength(1);
    expect(view.fallen).toBe(2);
  });

  it('胜利无重伤、备战不入图、完整多格占位及存档恢复不丢失', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, 'reserve');
    s.transfer({ type: 'offer', id: 2 }, { x: 1, y: 3 });
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
    s.start();
    // An empty field is a legitimate no-damage victory, independent of skill balance.
    s.battle!.spawns = [];
    s.tick();
    expect(s.phase).toBe('victory');
    const saved = s.exportSave();
    expect(validSave(saved)).toBe(true);
    const view = battleFormation(s.battle!, 'end')!;
    expect(view.historyRecorded).toBe(true);
    expect(view.moments.map((m) => m.key)).toEqual(['start', 'end']);
    expect(view.standing).toBe(3);
    expect(view.units).toHaveLength(3);
    expect(view.units.find((u) => u.kind === 'sword_eagle')).toMatchObject({ width: 2, height: 2 });
    expect(view.units.find((u) => u.kind === 'boar')).toMatchObject({ width: 2, height: 1 });
    for (const unit of view.units) {
      const footprint = cells(unit.kind, unit.position);
      expect(unit.width * unit.height).toBe(footprint.length);
    }
    expect(battleFormation(Session.restore(saved).battle, 'end')).toEqual(view);
    expect(battleFormation(s.battle, 'not-a-moment')!.selected.key).toBe('end');
  });
});
