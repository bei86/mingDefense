import { bossName, enemyAppearances, type EnemyKind } from '../game/content';
import type { Combat } from '../game/combat-model';

export type UpcomingEnemy = {
  index: number;
  kind: EnemyKind;
  name: string;
  at: number;
  remainingMs: number;
  column: number;
};
export type UpcomingEnemyView = {
  remaining: number;
  counts: { kind: EnemyKind; name: string; count: number }[];
  next: UpcomingEnemy[];
  hiddenCount: number;
  ended: boolean;
};

export function arrivalLabel(remainingMs: number): string {
  if (remainingMs <= 0) return '待出场';
  return `${Math.ceil(remainingMs / 100) / 10} 秒后`;
}

/** Read the actual unconsumed spawn queue; time alone cannot tell whether an entry has run. */
export function upcomingEnemies(battle: Combat | null): UpcomingEnemyView | null {
  if (!battle) return null;
  const pending = battle.spawns.slice(battle.spawnIndex);
  const name = (kind: EnemyKind) =>
    kind === 'boss' ? bossName(battle.stageId) : enemyAppearances[kind].name;
  const counts = new Map<EnemyKind, number>();
  for (const spawn of pending) {
    const kind = spawn.kind ?? 'wolf';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const next = pending.slice(0, 8).map((spawn, index) => {
    const kind = spawn.kind ?? 'wolf';
    return {
      index: battle.spawnIndex + index,
      kind,
      name: name(kind),
      at: spawn.at,
      remainingMs: Math.max(0, spawn.at - battle.time),
      column: Math.floor(spawn.x) + 1,
    };
  });
  return {
    remaining: pending.length,
    counts: [...counts].map(([kind, count]) => ({ kind, name: name(kind), count })),
    next,
    hiddenCount: pending.length - next.length,
    ended: battle.result !== null,
  };
}
