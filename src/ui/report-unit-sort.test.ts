import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { UnitBattleStats } from '../game/combat-model';
import { clone } from '../game/content';
import { Session } from '../game/session';
import { battleReportDocument } from './battle-report-export';
import { reportMetrics, reportValue, sortReportUnits } from './report-unit-sort';
import { ReportUnitTable } from './ReportUnits';
import { BattleReport } from './BattleReport';

function entry(id: number, values: Partial<UnitBattleStats> = {}): UnitBattleStats {
  return {
    id,
    damageDone: 0,
    damageTaken: 0,
    shieldGiven: 0,
    shieldAbsorbed: 0,
    income: 0,
    ...values,
  };
}

function completedBattle() {
  const session = new Session();
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  session.transfer({ type: 'offer', id: 2 }, { merge: 5 });
  session.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
  session.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  session.start();
  for (let i = 0; i < 10000 && session.phase === 'combat'; i++) {
    if (session.hasChoices) session.chooseBuff(session.battle!.choices[0]);
    else session.tick();
  }
  expect(session.phase).toBe('victory');
  return session;
}

describe('逐兽战报多维排序', () => {
  it.each(reportMetrics)('$label独立降序，同值按编号，输入数组不变', ({ key }) => {
    const entries = [
      entry(9, { [key]: 30 }),
      entry(7, { [key]: 50 }),
      entry(4, { [key]: 50 }),
      entry(2),
    ];
    const before = clone(entries);
    expect(sortReportUnits(entries, key).map((unit) => unit.id)).toEqual([4, 7, 9, 2]);
    expect(entries).toEqual(before);
  });

  it('旧记录缺失、非数值排在真实0之后，缺失项也按编号且不补写字段', () => {
    const absent = { id: 2 } as UnitBattleStats;
    const invalid = entry(3, { shieldAbsorbed: Number.NaN });
    const entries = [invalid, absent, entry(10), entry(11, { shieldAbsorbed: 2 })];
    expect(sortReportUnits(entries, 'shieldAbsorbed').map((unit) => unit.id)).toEqual([
      11, 10, 2, 3,
    ]);
    expect(reportValue(absent, 'shieldAbsorbed')).toBeNull();
    expect(reportValue(invalid, 'shieldAbsorbed')).toBeNull();
    expect(reportValue(entry(10), 'shieldAbsorbed')).toBe(0);
    expect(absent).toEqual({ id: 2 });
    expect(sortReportUnits([], 'income')).toEqual([]);
  });

  it('真实已结算战斗切换全部指标，不改变保存、导出、战报顺序或资源', () => {
    const session = completedBattle();
    const battle = session.battle!;
    const before = clone(session);
    const saved = session.exportSave();
    const document = battleReportDocument(session, false);
    for (const { key, label } of reportMetrics) {
      const rows = sortReportUnits(battle.report!.units, key);
      expect(rows).toHaveLength(battle.allies.length);
      const html = renderToStaticMarkup(
        createElement(ReportUnitTable, { battle, metric: key, onMetric: () => {} }),
      );
      expect(html).toContain(`按${label}降序`);
      expect(html).toContain('aria-label="逐兽战报排序"');
      expect(html).toContain(`value="${key}" selected=""`);
      expect(html.indexOf(`data-unit-id="${rows[0].id}"`)).toBeLessThan(
        html.indexOf(`data-unit-id="${rows[1].id}"`),
      );
      for (const ally of battle.allies) expect(html).toContain(`#${ally.id}`);
    }
    expect(session).toEqual(before);
    expect(session.exportSave()).toEqual(saved);
    expect(battleReportDocument(session, false)).toEqual(document);
  });

  it('旧护盾缺失显示未记录且区别于0，整表默认伤害；完全没有战报仍显示原提示', () => {
    const battle = completedBattle().battle!;
    const first = battle.report!.units[0];
    delete (first as Partial<UnitBattleStats>).shieldAbsorbed;
    const html = renderToStaticMarkup(
      createElement(ReportUnitTable, { battle, metric: 'shieldAbsorbed', onMetric: () => {} }),
    );
    expect(html).toContain('吸收 未记录');
    expect(html).toContain('施盾 0');
    expect(html).toContain('吸收 0');
    const full = renderToStaticMarkup(createElement(BattleReport, { battle }));
    expect(full).toContain('按伤害降序');
    expect(full).not.toContain('<details class="unit-report" open');
    delete battle.report;
    const old = renderToStaticMarkup(createElement(BattleReport, { battle }));
    expect(old).toContain('旧战报未记录逐兽数据');
    expect(old).not.toContain('逐兽战报排序');
  });
});
