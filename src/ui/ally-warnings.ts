import type { BossWarningTarget } from './boss-warnings';
import type { EnemyInspectionView } from './enemy-inspection';

export type AllyWarning = Omit<BossWarningTarget, 'source'> & {
  source: { id: number; name: string };
  remainingMs: number;
  frozenMs: number;
};

/** Reverse the existing full-footprint lists; do not infer warnings from cached locks. */
export function allyWarnings(view: EnemyInspectionView | null, unitId: number): AllyWarning[] {
  const warnings =
    view?.enemies.flatMap((enemy) => {
      if (enemy.kind !== 'boss') return [];
      return enemy.warnings
        .filter((warning) => warning.allies.some((ally) => ally.id === unitId))
        .map((warning) => ({
          source: { id: enemy.id, name: enemy.name },
          row: warning.row,
          echo: warning.echo,
          remainingMs: warning.remainingMs,
          frozenMs: warning.frozenMs,
        }));
    }) ?? [];
  return warnings.sort(
    (a, b) =>
      a.source.id - b.source.id ||
      a.row - b.row ||
      Number(a.echo) - Number(b.echo) ||
      a.remainingMs - b.remainingMs,
  );
}
