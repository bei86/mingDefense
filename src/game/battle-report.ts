import type { Combat, UnitBattleStats } from './combat-model';

/** Observe at step end; IDs within one batch do not imply a fall order. */
export function recordFalls(s: Combat): void {
  const falls = s.report?.falls;
  if (!falls) return;
  const recorded = new Set(falls.flatMap((batch) => batch.unitIds));
  const unitIds = s.allies
    .filter((u) => u.hp <= 0 && !recorded.has(u.id))
    .map((u) => u.id)
    .sort((a, b) => a - b);
  if (unitIds.length) falls.push({ at: s.time, unitIds });
}

export function recordUnitStat(
  s: Combat,
  id: number | undefined,
  stat: Exclude<keyof UnitBattleStats, 'id'>,
  amount: number,
): void {
  const entry = s.report?.units.find((u) => u.id === id);
  if (entry) entry[stat] += amount;
}
