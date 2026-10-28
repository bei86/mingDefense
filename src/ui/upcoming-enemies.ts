import { bossName, enemyAppearances, type EnemyKind } from '../game/content';
import type { Combat } from '../game/combat-model';

export const UPCOMING_PAGE_SIZE = 8;

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
  page: number;
  pageCount: number;
};

export function arrivalLabel(remainingMs: number): string {
  if (remainingMs <= 0) return '待出场';
  return `${Math.ceil(remainingMs / 100) / 10} 秒后`;
}

/** Read the actual unconsumed spawn queue; time alone cannot tell whether an entry has run. */
export function upcomingEnemies(
  battle: Combat | null,
  requestedPage = 0,
): UpcomingEnemyView | null {
  if (!battle) return null;
  const pending = battle.spawns.slice(battle.spawnIndex);
  const pageCount = Math.ceil(pending.length / UPCOMING_PAGE_SIZE);
  const page = Math.min(
    Math.max(0, Math.floor(Number.isFinite(requestedPage) ? requestedPage : 0)),
    Math.max(0, pageCount - 1),
  );
  const offset = page * UPCOMING_PAGE_SIZE;
  const name = (kind: EnemyKind) =>
    kind === 'boss' ? bossName(battle.stageId) : enemyAppearances[kind].name;
  const counts = new Map<EnemyKind, number>();
  for (const spawn of pending) {
    const kind = spawn.kind ?? 'wolf';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const next = pending.slice(offset, offset + UPCOMING_PAGE_SIZE).map((spawn, index) => {
    const kind = spawn.kind ?? 'wolf';
    return {
      index: battle.spawnIndex + offset + index,
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
    page,
    pageCount,
  };
}
