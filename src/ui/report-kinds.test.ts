import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import type { UnitBattleStats } from '../game/combat-model';
import { clone, heroIds } from '../game/content';
import { Session } from '../game/session';
import { battleReportDocument } from './battle-report-export';
import { reportMetrics } from './report-unit-sort';
import { reportKindSummary } from './report-kinds';
import { ReportKindTable } from './ReportUnits';

function setup() {
  const battle = createCombat([
    { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 3 } },
    { id: 11, kind: 'ember_mouse', rank: 2, position: { x: 1, y: 3 } },
    { id: 12, kind: 'boar', rank: 2, position: { x: 2, y: 3 } },
    { id: 13, kind: 'shield_fox', rank: 1, position: { x: 4, y: 3 } },
    { id: 14, kind: 'ember_mouse', rank: 3, position: null },
  ]);
  battle.allies[0].hp = 0;
  const stats = battle.report!.units;
  for (const { key } of reportMetrics) {
    stats.find((row) => row.id === 10)![key] = 30;
    stats.find((row) => row.id === 11)![key] = 50;
    stats.find((row) => row.id === 12)![key] = 60;
    stats.find((row) => row.id === 13)![key] = 20;
  }
  return battle;
}

describe('结算同种灵兽贡献', () => {
  it.each(reportMetrics)(
    '$label按同种相加、重伤不丢且不混入备战，每项守恒与排序正确',
    ({ key }) => {
      const battle = setup();
      const before = clone(battle);
      const groups = reportKindSummary(battle, key)!;
      expect(groups.map((group) => group.kind)).toEqual(['ember_mouse', 'boar', 'shield_fox']);
      expect(groups[0]).toMatchObject({
        kind: 'ember_mouse',
        count: 2,
        fallen: 1,
        ranks: [
          { rank: 1, count: 1 },
          { rank: 2, count: 1 },
        ],
        metrics: { [key]: { value: 80, recorded: 2 } },
      });
      expect(groups.reduce((sum, group) => sum + group.metrics[key].value!, 0)).toBe(
        battle.report!.units.reduce((sum, entry) => sum + entry[key], 0),
      );
      expect(battle).toEqual(before);
      groups[0].ranks[0].count = 99;
      expect(battle.allies[0].rank).toBe(1);
    },
  );

  it('不同指标分别累计，不把提供护盾算成吸收，全部0同值顺序不受实例/数组顺序影响', () => {
    const battle = setup();
    for (const entry of battle.report!.units) {
      entry.shieldGiven = entry.id === 13 ? 400 : 0;
      entry.shieldAbsorbed = entry.id === 10 ? 75 : 0;
      entry.income = 0;
    }
    battle.allies.reverse();
    battle.report!.units.reverse();
    const shields = reportKindSummary(battle, 'shieldGiven')!;
    expect(shields[0].kind).toBe('shield_fox');
    expect(shields[0].metrics.shieldGiven.value).toBe(400);
    expect(shields[0].metrics.shieldAbsorbed.value).toBe(0);
    expect(reportKindSummary(battle, 'shieldAbsorbed')![0].kind).toBe('ember_mouse');
    const groups = reportKindSummary(battle, 'income')!;
    expect(groups.map((group) => group.kind)).toEqual(
      heroIds.filter((kind) => groups.some((group) => group.kind === kind)),
    );
  });

  it('缺成员/缺指标不能显示部分合计，完整0排在缺失之前，其他完整指标不受影响', () => {
    const battle = setup();
    delete (battle.report!.units.find((entry) => entry.id === 10) as Partial<UnitBattleStats>)
      .damageDone;
    battle.report!.units = battle.report!.units.filter((entry) => entry.id !== 12);
    battle.report!.units.find((entry) => entry.id === 13)!.damageDone = 0;
    const groups = reportKindSummary(battle, 'damageDone')!;
    expect(groups.map((group) => group.kind)).toEqual(['shield_fox', 'ember_mouse', 'boar']);
    expect(groups[1].metrics.damageDone).toEqual({ value: null, recorded: 1 });
    expect(groups[1].metrics.damageTaken).toEqual({ value: 80, recorded: 2 });
    expect(groups[2].metrics.damageDone).toEqual({ value: null, recorded: 0 });
    const html = renderToStaticMarkup(
      createElement(ReportKindTable, { battle, metric: 'damageDone', onMetric: () => {} }),
    );
    expect(html).toContain('未完整记录');
    expect(html).toContain('未记录');
    expect(html).not.toContain('>50<');
    expect(html).toContain('2只 · 重伤1只');
    expect(html).toContain('1阶×1、2阶×1');
  });

  it('空/null/没有战报不伪造数据，非有限指标按未记录，表格说明合计口径', () => {
    expect(reportKindSummary(null, 'income')).toBeNull();
    const battle = setup();
    battle.report!.units.find((entry) => entry.id === 13)!.income = Number.NaN;
    expect(
      reportKindSummary(battle, 'income')!.find((group) => group.kind === 'shield_fox')!.metrics
        .income,
    ).toEqual({ value: null, recorded: 0 });
    const html = renderToStaticMarkup(
      createElement(ReportKindTable, { battle, metric: 'shieldGiven', onMetric: () => {} }),
    );
    expect(html).toContain('同种合计 · 按提供护盾降序');
    expect(html).toContain('不同阶同种灵兽相加');
    expect(html).toContain('不是单只强度排名');
    battle.allies = [];
    expect(reportKindSummary(battle, 'income')).toEqual([]);
    delete battle.report;
    expect(reportKindSummary(battle, 'income')).toBeNull();
    expect(
      renderToStaticMarkup(
        createElement(ReportKindTable, { battle, metric: 'income', onMetric: () => {} }),
      ),
    ).toBe('');
  });

  it('真实两鼠上阵完整战斗后，五种合计守恒且保存/导出/结算资源不变', () => {
    const session = new Session();
    for (const [id, x, y] of [
      [1, 1, 3],
      [2, 2, 3],
      [3, 1, 4],
      [4, 3, 4],
    ]) {
      expect(session.transfer({ type: 'offer', id }, { x, y })).toBeNull();
    }
    expect(session.start()).toBeNull();
    for (let i = 0; i < 10000 && session.phase === 'combat'; i++) {
      if (session.hasChoices) session.chooseBuff(session.battle!.choices[0]);
      else session.tick();
    }
    expect(session.phase).toBe('victory');
    const before = clone(session);
    const save = session.exportSave();
    const document = battleReportDocument(session, false);
    for (const { key, label } of reportMetrics) {
      const groups = reportKindSummary(session.battle!, key)!;
      expect(groups.find((group) => group.kind === 'ember_mouse')!.count).toBe(2);
      expect(groups.reduce((sum, group) => sum + group.metrics[key].value!, 0)).toBe(
        session.battle!.report!.units.reduce((sum, entry) => sum + entry[key], 0),
      );
      expect(
        renderToStaticMarkup(
          createElement(ReportKindTable, {
            battle: session.battle!,
            metric: key,
            onMetric: () => {},
          }),
        ),
      ).toContain(`同种合计 · 按${label}降序`);
    }
    expect(session).toEqual(before);
    expect(session.exportSave()).toEqual(save);
    expect(battleReportDocument(session, false)).toEqual(document);
  });
});
