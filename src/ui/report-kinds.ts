import type { Combat } from '../game/combat-model';
import { heroIds, type HeroId } from '../game/content';
import { reportMetrics, reportValue, type ReportMetric } from './report-unit-sort';

export type ReportKind = {
  kind: HeroId;
  count: number;
  fallen: number;
  ranks: { rank: number; count: number }[];
  metrics: Record<ReportMetric, { value: number | null; recorded: number }>;
};

/** Aggregate battle participants only. Incomplete totals are deliberately unavailable. */
export function reportKindSummary(
  battle: Combat | null,
  metric: ReportMetric,
): ReportKind[] | null {
  if (!battle?.report) return null;
  const stats = new Map(battle.report.units.map((entry) => [entry.id, entry]));
  const groups: ReportKind[] = [];
  for (const kind of heroIds) {
    const members = battle.allies.filter((ally) => ally.kind === kind);
    if (members.length === 0) continue;
    const ranks = new Map<number, number>();
    for (const ally of members) ranks.set(ally.rank, (ranks.get(ally.rank) ?? 0) + 1);
    const metrics = Object.fromEntries(
      reportMetrics.map(({ key }) => {
        let total = 0;
        let recorded = 0;
        for (const ally of members) {
          const entry = stats.get(ally.id);
          const value = entry ? reportValue(entry, key) : null;
          if (value === null) continue;
          total += value;
          recorded++;
        }
        return [key, { value: recorded === members.length ? total : null, recorded }];
      }),
    ) as ReportKind['metrics'];
    groups.push({
      kind,
      count: members.length,
      fallen: members.filter((ally) => ally.hp <= 0).length,
      ranks: [...ranks].sort(([a], [b]) => a - b).map(([rank, count]) => ({ rank, count })),
      metrics,
    });
  }
  return groups.sort((a, b) => {
    const left = a.metrics[metric].value;
    const right = b.metrics[metric].value;
    if (left === null && right !== null) return 1;
    if (left !== null && right === null) return -1;
    return (right ?? 0) - (left ?? 0) || heroIds.indexOf(a.kind) - heroIds.indexOf(b.kind);
  });
}
