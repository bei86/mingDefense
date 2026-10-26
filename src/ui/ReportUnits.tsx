import { useState } from 'react';
import type { Combat } from '../game/combat-model';
import { appearances } from '../game/content';
import { reportMetrics, reportValue, sortReportUnits, type ReportMetric } from './report-unit-sort';
import './report-units.css';

type TableProps = {
  battle: Combat;
  metric: ReportMetric;
  onMetric: (metric: ReportMetric) => void;
};

export function ReportUnitTable({ battle, metric, onMetric }: TableProps) {
  if (!battle.report) return null;
  const label = reportMetrics.find((entry) => entry.key === metric)!.label;
  return (
    <>
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
      <div className="report-table-wrap">
        <table className="report-table">
          <caption>本关上阵灵兽表现 · 按{label}降序</caption>
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
  return <ReportUnitTable battle={battle} metric={metric} onMetric={setMetric} />;
}
