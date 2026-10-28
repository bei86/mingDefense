import type { Combat } from '../game/combat';

export type BossWarning = {
  source: number;
  row: number;
  echo: boolean;
  remainingMs: number;
  frozen: boolean;
};

/** Only project warnings that already exist; never predict the next cleave. */
export function bossWarnings(battle: Combat | null): BossWarning[] {
  if (!battle) return [];
  const bosses = new Map(
    battle.enemies
      .filter((enemy) => enemy.kind === 'boss' && enemy.hp > 0)
      .map((enemy) => [enemy.id, enemy]),
  );
  return battle.warnings
    .filter((warning) => bosses.has(warning.source))
    .sort(
      (a, b) =>
        a.due - b.due ||
        a.source - b.source ||
        a.row - b.row ||
        Number(!!a.echo) - Number(!!b.echo),
    )
    .map((warning) => ({
      source: warning.source,
      row: warning.row + 1,
      echo: !!warning.echo,
      remainingMs: Math.max(0, warning.due - battle.time),
      frozen: (bosses.get(warning.source)!.frozenUntil ?? 0) > battle.time,
    }));
}
