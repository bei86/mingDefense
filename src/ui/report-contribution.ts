import type { Combat } from '../game/combat-model';
import { reportValue, type ReportMetric } from './report-unit-sort';

export type ReportContributionModel = { total: number | null; missing: number };

/** Use every participant, including fallen allies, rather than the currently displayed rows. */
export function reportContribution(
  battle: Combat | null,
  metric: ReportMetric,
): ReportContributionModel | null {
  if (!battle?.report) return null;
  const stats = new Map(battle.report.units.map((entry) => [entry.id, entry]));
  let total = 0;
  let missing = 0;
  for (const ally of battle.allies) {
    const entry = stats.get(ally.id);
    const value = entry ? reportValue(entry, metric) : null;
    if (value === null || value < 0) missing++;
    else total += value;
  }
  return { total: missing === 0 ? total : null, missing };
}

export function contributionShare(
  value: number | null,
  model: ReportContributionModel,
): { percent: number; label: string } | null {
  const total = model.total;
  if (
    total === null ||
    !Number.isFinite(total) ||
    total <= 0 ||
    model.missing > 0 ||
    value === null ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > total
  )
    return null;
  const percent = (value / total) * 100;
  const label = percent > 0 && percent < 0.1 ? '<0.1%' : `${percent.toFixed(1)}%`;
  return { percent, label };
}
