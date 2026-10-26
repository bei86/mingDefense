import type { UnitBattleStats } from '../game/combat-model';

export const reportMetrics = [
  { key: 'damageDone', label: '伤害' },
  { key: 'damageTaken', label: '承伤' },
  { key: 'shieldGiven', label: '提供护盾' },
  { key: 'shieldAbsorbed', label: '护盾吸收' },
  { key: 'income', label: '产钱' },
] as const;

export type ReportMetric = (typeof reportMetrics)[number]['key'];

/** Older reports may not contain every metric. A missing record is not zero. */
export function reportValue(entry: UnitBattleStats, metric: ReportMetric): number | null {
  const value = entry[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function sortReportUnits(
  entries: readonly UnitBattleStats[],
  metric: ReportMetric,
): UnitBattleStats[] {
  return [...entries].sort((a, b) => {
    const left = reportValue(a, metric);
    const right = reportValue(b, metric);
    if (left === null && right !== null) return 1;
    if (left !== null && right === null) return -1;
    return (right ?? 0) - (left ?? 0) || a.id - b.id;
  });
}
