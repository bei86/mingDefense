import type { Combat, UnitBattleStats } from './combat-model';

export function recordUnitStat(
  s: Combat,
  id: number | undefined,
  stat: Exclude<keyof UnitBattleStats, 'id'>,
  amount: number,
): void {
  const entry = s.report?.units.find((u) => u.id === id);
  if (entry) entry[stat] += amount;
}
