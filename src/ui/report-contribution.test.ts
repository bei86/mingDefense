import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import type { UnitBattleStats } from '../game/combat-model';
import { clone } from '../game/content';
import { Session } from '../game/session';
import { battleReportDocument } from './battle-report-export';
import { reportMetrics } from './report-unit-sort';
import { reportKindSummary } from './report-kinds';
import { contributionShare, reportContribution } from './report-contribution';
import { ReportContributionShare, ReportContributionTotal } from './ReportContribution';
import { ReportKindTable, ReportUnitTable } from './ReportUnits';

function setup() {
  const battle = createCombat([
    { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
    { id: 11, kind: 'ember_mouse', rank: 2, position: { x: 2, y: 3 } },
    { id: 12, kind: 'boar', rank: 1, position: { x: 3, y: 3 } },
    { id: 13, kind: 'fortune_peach', rank: 1, position: null },
  ]);
  battle.allies[0].hp = 0;
  for (const { key } of reportMetrics) {
    battle.report!.units[0][key] = 60;
    battle.report!.units[1][key] = 30;
    battle.report!.units[2][key] = 10;
  }
  const unrelated = {
    id: 13,
    damageDone: 999,
    damageTaken: 999,
    shieldGiven: 999,
    shieldAbsorbed: 999,
    income: 999,
  };
  battle.report!.units.push(unrelated);
  return battle;
}

describe('战报贡献占比', () => {
  it.each(reportMetrics)('$label分母仅计参战者，重伤仍计、无关/备战行排除且投影只读', ({ key }) => {
    const battle = setup();
    const before = clone(battle);
    expect(reportContribution(battle, key)).toEqual({ total: 100, missing: 0 });
    const groups = reportKindSummary(battle, key)!;
    expect(
      contributionShare(
        groups.find((group) => group.kind === 'ember_mouse')!.metrics[key].value,
        reportContribution(battle, key)!,
      ),
    ).toEqual({ percent: 90, label: '90.0%' });
    expect(battle).toEqual(before);
  });

  it('缺字段、缺整行或非法数值均禁用全队比例，不拿已知部分或战斗总伤害补足', () => {
    const battle = setup();
    delete (battle.report!.units[0] as Partial<UnitBattleStats>).damageDone;
    battle.damageDone = 10000;
    expect(reportContribution(battle, 'damageDone')).toEqual({ total: null, missing: 1 });
    expect(reportContribution(battle, 'income')).toEqual({ total: 100, missing: 0 });
    battle.report!.units = battle.report!.units.filter((entry) => entry.id !== 11);
    battle.report!.units.find((entry) => entry.id === 12)!.damageDone = Number.NaN;
    expect(reportContribution(battle, 'damageDone')).toEqual({ total: null, missing: 3 });
    battle.report!.units.find((entry) => entry.id === 12)!.damageDone = -1;
    expect(reportContribution(battle, 'damageDone')).toEqual({ total: null, missing: 3 });
    expect(contributionShare(10, reportContribution(battle, 'damageDone')!)).toBeNull();
  });

  it('全0/无报告/空阵线安全，真实0和微小正占比、四舍五入及100%区分', () => {
    const battle = setup();
    for (const entry of battle.report!.units) entry.income = 0;
    const zero = reportContribution(battle, 'income')!;
    expect(zero).toEqual({ total: 0, missing: 0 });
    expect(contributionShare(0, zero)).toBeNull();
    const model = { total: 3000, missing: 0 };
    expect(contributionShare(0, model)).toEqual({ percent: 0, label: '0.0%' });
    expect(contributionShare(1, model)!.label).toBe('<0.1%');
    expect(contributionShare(1, { total: 3, missing: 0 })!.label).toBe('33.3%');
    expect(contributionShare(3000, model)).toEqual({ percent: 100, label: '100.0%' });
    for (const value of [null, -1, Number.NaN, Number.POSITIVE_INFINITY, 3001])
      expect(contributionShare(value, model)).toBeNull();
    battle.allies = [];
    expect(reportContribution(battle, 'damageDone')).toEqual({ total: 0, missing: 0 });
    delete battle.report;
    expect(reportContribution(battle, 'income')).toBeNull();
    expect(reportContribution(null, 'income')).toBeNull();
  });

  it('SSR完整显示值与真实条宽；缺失/零态明确且不出现比例条，微小正数不假装0', () => {
    const model = { total: 3, missing: 0 };
    const normal = renderToStaticMarkup(
      createElement(ReportContributionShare, { model, metric: 'damageDone', value: 1 }),
    );
    expect(normal).toContain('伤害占比 33.3%');
    expect(normal).toContain('width:33.33333333333333%');
    expect(normal).toContain('aria-hidden="true"');
    const tiny = renderToStaticMarkup(
      createElement(ReportContributionShare, {
        model: { total: 3000, missing: 0 },
        metric: 'income',
        value: 1,
      }),
    );
    expect(tiny).toContain('&lt;0.1%');
    for (const state of [
      { total: 0, missing: 0 },
      { total: null, missing: 1 },
    ]) {
      const share = renderToStaticMarkup(
        createElement(ReportContributionShare, { model: state, metric: 'income', value: 0 }),
      );
      expect(share).toContain('占比未计算');
      expect(share).not.toContain('report-contribution-track');
      const summary = renderToStaticMarkup(
        createElement(ReportContributionTotal, { model: state, metric: 'income' }),
      );
      expect(summary).toContain(state.total === 0 ? '本项合计为0' : '缺1只记录');
      expect(summary).toContain('不计算占比');
    }
  });

  it('真实双鼠战斗的逐只与同种同分母，五项比例读取后保存/导出/结算不变', () => {
    const session = new Session();
    for (const [id, x, y] of [
      [1, 1, 3],
      [2, 2, 3],
      [3, 1, 4],
      [4, 3, 4],
    ])
      expect(session.transfer({ type: 'offer', id }, { x, y })).toBeNull();
    expect(session.start()).toBeNull();
    for (let i = 0; i < 10000 && session.phase === 'combat'; i++) {
      if (session.hasChoices) session.chooseBuff(session.battle!.choices[0]);
      else session.tick();
    }
    expect(session.phase).toBe('victory');
    const battle = session.battle!;
    const before = clone(session);
    const saved = session.exportSave();
    const document = battleReportDocument(session, false);
    for (const { key, label } of reportMetrics) {
      const model = reportContribution(battle, key)!;
      const sum = battle.report!.units.reduce((total, entry) => total + entry[key], 0);
      expect(model.total).toBe(sum);
      const groups = reportKindSummary(battle, key)!;
      if (sum > 0) {
        expect(
          groups.reduce(
            (total, group) => total + contributionShare(group.metrics[key].value, model)!.percent,
            0,
          ),
        ).toBeCloseTo(100);
      }
      for (const Component of [ReportUnitTable, ReportKindTable]) {
        const html = renderToStaticMarkup(
          createElement(Component, { battle, metric: key, onMetric: () => {} }),
        );
        expect(html).toContain(`全队${label}合计`);
        if (sum === 0) expect(html).not.toContain('report-contribution-track');
        else expect(html).toContain('report-contribution-track');
      }
    }
    expect(session).toEqual(before);
    expect(session.exportSave()).toEqual(saved);
    expect(battleReportDocument(session, false)).toEqual(document);
  });
});
