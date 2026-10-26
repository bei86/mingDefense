import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCombat } from '../game/combat';
import { clone } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { Session } from '../game/session';
import { defeatRecap } from './defeat-advice';
import { defeatFormation, firstFallSnapshot } from './defeat-formation';
import { DefeatFormation } from './DefeatFormation';

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

describe('败后布阵回顾', () => {
  it('真实双鼠首批按重伤记录，不按累计伤害或同种数组顺序识别', () => {
    const s = defeated();
    const recap = defeatRecap(s.battle)!;
    expect(recap.firstFall).toEqual({
      at: 22650,
      units: [{ id: 6, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 3 } }],
    });
    expect(recap.damageFact).toContain('第2列第4行');
    s.backToPreparation();
    expect(defeatFormation(s.preparation, recap)).toMatchObject([
      { previous: { id: 6 }, current: { id: 6, rank: 1 }, status: 'same' },
    ]);
    expect(s.transfer({ type: 'unit', id: 6 }, { x: 3, y: 3 })).toBeNull();
    expect(defeatFormation(s.preparation, recap)).toMatchObject([
      {
        previous: { position: { x: 2, y: 3 } },
        current: { position: { x: 3, y: 3 } },
        status: 'moved',
      },
    ]);
    expect(s.undo()).toBeNull();
    expect(defeatFormation(s.preparation, recap)[0].status).toBe('same');
    expect(s.transfer({ type: 'unit', id: 6 }, 'reserve')).toBeNull();
    expect(defeatFormation(s.preparation, recap)).toMatchObject([
      { current: { id: 6, position: null }, status: 'reserve' },
    ]);
    expect(s.undo()).toBeNull();
    expect(defeatFormation(s.preparation, recap)[0].status).toBe('same');
  });

  it('合成保留目标身份及新阶数，消耗首批实例后不匹配到另一只同种灵兽', () => {
    const s = defeated();
    const recap = defeatRecap(s.battle)!;
    s.backToPreparation();
    expect(s.transfer({ type: 'unit', id: 5 }, { merge: 6 })).toBeNull();
    expect(defeatFormation(s.preparation, recap)).toMatchObject([
      { previous: { id: 6, rank: 1 }, current: { id: 6, rank: 2 }, status: 'same' },
    ]);
    s.undo();
    expect(s.transfer({ type: 'unit', id: 6 }, { merge: 5 })).toBeNull();
    expect(defeatFormation(s.preparation, recap)).toMatchObject([
      { previous: { id: 6 }, current: null, status: 'absent' },
    ]);
    s.undo();
    expect(defeatFormation(s.preparation, recap)[0].status).toBe('same');
  });

  it('同批保留全部实例，不用时间相同或行列制造先后；旧/无记录分清', () => {
    const b = defeated().battle!;
    b.report!.falls = [{ at: b.time, unitIds: [6, 5] }];
    expect(firstFallSnapshot(b)?.units.map((u) => u.id)).toEqual([6, 5]);
    b.report!.falls = [];
    expect(defeatRecap(b)?.firstFall).toBeNull();
    delete b.report!.falls;
    expect(defeatRecap(b)?.firstFall).toBeUndefined();
    delete b.report;
    expect(defeatRecap(b)?.firstFall).toBeUndefined();
    const p = new Session().preparation;
    expect(defeatFormation(p, { stageId: p.stageId })).toEqual([]);
    expect(defeatFormation(p, { stageId: p.stageId, firstFall: null })).toEqual([]);
  });

  it('多格身份与原位置独立复制，对照只读，跨关及种类不匹配不串用', () => {
    const s = rosterPlaytest();
    const b = createCombat(s.preparation.units);
    b.result = 'defeat';
    b.report!.falls = [{ at: 1234, unitIds: [7, 10, 12] }];
    const before = clone(b);
    const recap = defeatRecap(b)!;
    expect(b).toEqual(before);
    const saved = clone(s.exportSave());
    const view = defeatFormation(s.preparation, recap);
    expect(view.map((row) => row.previous.id)).toEqual([7, 10, 12]);
    expect(s.exportSave()).toEqual(saved);
    expect(recap.firstFall!.units).toEqual(
      b.allies
        .filter((u) => [7, 10, 12].includes(u.id))
        .map(({ id, kind, rank, position }) => ({ id, kind, rank, position })),
    );
    view[0].previous.position.x = 5;
    view[1].current!.position!.y = 0;
    view[2].current!.rank = 6;
    expect(b).toEqual(before);
    expect(s.exportSave()).toEqual(saved);
    expect(recap.firstFall!.units[0].position.x).toBe(2);
    b.allies[0].position.x = 5;
    b.allies.find((u) => u.id === 7)!.position.x = 5;
    expect(recap.firstFall!.units[0].position.x).toBe(2);
    s.preparation.units.find((u) => u.id === 7)!.kind = 'ember_mouse';
    expect(defeatFormation(s.preparation, recap)[0].status).toBe('absent');
    s.preparation.stageId = 2;
    expect(defeatFormation(s.preparation, recap)).toEqual([]);
  });

  it('整备对照完整列出多格占位；结算仅摘要；旧报告和无重伤不虚构记录', () => {
    const s = rosterPlaytest();
    const b = createCombat(s.preparation.units);
    b.result = 'defeat';
    b.report!.falls = [{ at: 1234, unitIds: [7, 10, 12] }];
    const recap = defeatRecap(b)!;
    const render = (preparing: boolean) =>
      renderToStaticMarkup(
        createElement(DefeatFormation, {
          preparation: s.preparation,
          recap,
          preparing,
        }),
      );
    const html = render(true);
    expect(html).toContain('1.23');
    expect(html).toContain('同批不区分先后');
    expect(html).toContain('3列3行、4列3行');
    expect(html).toContain('2列4行、2列5行、2列6行');
    expect(html).toContain('4列5行、5列5行、4列6行、5列6行');
    expect(html).toContain('<details>');
    expect(html).not.toContain('<details open');
    expect(render(false)).not.toContain('对照首批');
    expect(render(false)).not.toContain('当前：');
    recap.firstFall = undefined;
    expect(render(true)).toContain('未记录重伤时间');
    recap.firstFall = null;
    expect(render(true)).toContain('无灵兽重伤');
    s.preparation.stageId = 2;
    expect(render(true)).toBe('');
  });
});
