import type { EnemyInspectionView } from './enemy-inspection';

export type IncomingEnemyAttack = {
  source: { id: number; name: string };
  remainingMs: number;
  frozenMs: number;
};

/** Prepared basic attacks are independent of cached locks and sweep warnings. */
export function allyIncoming(
  view: EnemyInspectionView | null,
  unitId: number,
): IncomingEnemyAttack[] {
  const actions =
    view?.enemies.flatMap((enemy) => {
      const attack = enemy.attack;
      if (!attack) return [];
      return attack.pending
        .filter((pending) => pending.targetId === unitId && pending.targetAlive)
        .map((pending) => ({
          source: { id: enemy.id, name: enemy.name },
          remainingMs: pending.remainingMs,
          frozenMs: attack.frozenMs,
        }));
    }) ?? [];
  // Group by source rather than promising a release order while a source is frozen.
  return actions.sort((a, b) => a.source.id - b.source.id || a.remainingMs - b.remainingMs);
}
