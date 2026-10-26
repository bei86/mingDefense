import { useState } from 'react';
import type { Combat } from '../game/combat-model';
import { appearances } from '../game/content';
import { reportMetrics, reportValue, sortReportUnits, type ReportMetric } from './report-unit-sort';
import { reportKindSummary, type ReportKind } from './report-kinds';
import { reportContribution } from './report-contribution';
import { ReportContributionShare, ReportContributionTotal } from './ReportContribution';
import './report-units.css';

type TableProps = {
  battle: Combat;
  metric: ReportMetric;
  onMetric: (metric: ReportMetric) => void;
};

function ReportMetricSelect({ metric, onMetric }: Omit<TableProps, 'battle'>) {
  return (
    <label className="report-sort">
      逐兽战报排序
      <select
        aria-label="逐兽战报排序"
        value={metric}
        onChange={(event) => onMetric(event.target.value as ReportMetric)}
      >
        {reportMetrics.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {entry.label} · 从高到低
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportTableHead({ metric }: { metric: ReportMetric }) {
  return (
    <thead>
      <tr>
        <th scope="col">灵兽</th>
        <th scope="col" aria-sort={metric === 'damageDone' ? 'descending' : undefined}>
          伤害
        </th>
        <th scope="col" aria-sort={metric === 'damageTaken' ? 'descending' : undefined}>
          承伤
        </th>
        <th scope="col" aria-sort={metric === 'income' ? 'descending' : undefined}>
          产钱
        </th>
      </tr>
    </thead>
  );
}

export function ReportUnitTable({ battle, metric, onMetric }: TableProps) {
  const contribution = reportContribution(battle, metric);
  if (!battle.report || !contribution) return null;
  const label = reportMetrics.find((entry) => entry.key === metric)!.label;
  return (
    <>
      <ReportMetricSelect metric={metric} onMetric={onMetric} />
      <ReportContributionTotal model={contribution} metric={metric} />
      <div className="report-table-wrap">
        <table className="report-table">
          <caption>本关上阵灵兽表现 · 按{label}降序</caption>
          <ReportTableHead metric={metric} />
          <tbody>
            {sortReportUnits(battle.report.units, metric).map((entry) => {
              const ally = battle.allies.find((unit) => unit.id === entry.id)!;
              const skin = appearances[ally.kind];
              return (
                <tr key={entry.id} data-unit-id={entry.id}>
                  <th scope="row">
                    <strong style={{ color: skin.color }}>{skin.name}</strong>
                    <small>
                      {ally.rank}阶 · #{ally.id} · {ally.position.x + 1}列{ally.position.y + 1}行
                      {ally.hp <= 0 ? ' · 重伤' : ''}
                    </small>
                    <small
                      className={metric === 'shieldGiven' ? 'report-metric-active' : undefined}
                    >
                      施盾 {reportValue(entry, 'shieldGiven') ?? '未记录'}
                    </small>
                    <small
                      className={metric === 'shieldAbsorbed' ? 'report-metric-active' : undefined}
                    >
                      吸收 {reportValue(entry, 'shieldAbsorbed') ?? '未记录'}
                    </small>
                    <ReportContributionShare
                      model={contribution}
                      metric={metric}
                      value={reportValue(entry, metric)}
                    />
                  </th>
                  <td>{reportValue(entry, 'damageDone') ?? '未记录'}</td>
                  <td>{reportValue(entry, 'damageTaken') ?? '未记录'}</td>
                  <td>{reportValue(entry, 'income') ?? '未记录'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        按所选指标从高到低，同值按编号排列；未记录排在最后。提供护盾不等于实际吸收。
      </p>
    </>
  );
}

export function ReportUnits({ battle }: { battle: Combat }) {
  const [metric, setMetric] = useState<ReportMetric>('damageDone');
  const [mode, setMode] = useState<'unit' | 'kind'>('unit');
  return (
    <>
      <label className="report-sort">
        战报查看方式
        <select
          aria-label="战报查看方式"
          value={mode}
          onChange={(event) => setMode(event.target.value as 'unit' | 'kind')}
        >
          <option value="unit">逐只查看</option>
          <option value="kind">同种汇总</option>
        </select>
      </label>
      {mode === 'unit' ? (
        <ReportUnitTable battle={battle} metric={metric} onMetric={setMetric} />
      ) : (
        <ReportKindTable battle={battle} metric={metric} onMetric={setMetric} />
      )}
    </>
  );
}

function kindValue(group: ReportKind, metric: ReportMetric): number | string {
  const record = group.metrics[metric];
  if (record.value !== null) return record.value;
  return record.recorded > 0 ? '未完整记录' : '未记录';
}

export function ReportKindTable({ battle, metric, onMetric }: TableProps) {
  const groups = reportKindSummary(battle, metric);
  const contribution = reportContribution(battle, metric);
  if (!groups || !contribution) return null;
  const label = reportMetrics.find((entry) => entry.key === metric)!.label;
  return (
    <>
      <ReportMetricSelect metric={metric} onMetric={onMetric} />
      <ReportContributionTotal model={contribution} metric={metric} />
      <div className="report-table-wrap">
        <table className="report-table report-kind-table">
          <caption>本关同种合计 · 按{label}降序</caption>
          <ReportTableHead metric={metric} />
          <tbody>
            {groups.map((group) => (
              <tr key={group.kind} data-unit-kind={group.kind}>
                <th scope="row">
                  <strong style={{ color: appearances[group.kind].color }}>
                    {appearances[group.kind].name}
                  </strong>
                  <small>
                    {group.count}只 · 重伤{group.fallen}只
                  </small>
                  <small>
                    {group.ranks.map(({ rank, count }) => `${rank}阶×${count}`).join('、')}
                  </small>
                  <small className={metric === 'shieldGiven' ? 'report-metric-active' : undefined}>
                    施盾 {kindValue(group, 'shieldGiven')}
                  </small>
                  <small
                    className={metric === 'shieldAbsorbed' ? 'report-metric-active' : undefined}
                  >
                    吸收 {kindValue(group, 'shieldAbsorbed')}
                  </small>
                  <ReportContributionShare
                    model={contribution}
                    metric={metric}
                    value={group.metrics[metric].value}
                  />
                </th>
                <td>{kindValue(group, 'damageDone')}</td>
                <td>{kindValue(group, 'damageTaken')}</td>
                <td>{kindValue(group, 'income')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        不同阶同种灵兽相加，包含重伤者，备战不计；只数与阶数不同，不是单只强度排名。
      </p>
      <p className="report-note">
        任一成员缺少该项时不显示部分合计；完整值从高到低，缺失排最后，同值按八灵顺序。提供护盾不等于实际吸收。
      </p>
    </>
  );
}
