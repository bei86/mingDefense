import type { EnemyKind } from '../game/content';
import type { EnemyEffectStatus, EnemyInspectionView, InspectedEnemy } from './enemy-inspection';
import { sortEnemies, type EnemySort } from './enemy-sorting';

export type EnemyFilter = EnemyKind | 'all';
export type EnemyStatusFilter = EnemyEffectStatus | 'all' | 'unaffected';
type EnemyKindCount = { kind: EnemyKind; name: string; count: number };
export type EnemySelectionModel = {
  kinds: EnemyKindCount[];
  kind: EnemyFilter;
  order: EnemySort;
  status: EnemyStatusFilter;
  counts: Record<EnemyStatusFilter, number>;
  enemies: InspectedEnemy[];
  selectedId: number | undefined;
  total: number;
};

function matchesStatus(enemy: InspectedEnemy, status: EnemyStatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'unaffected') return enemy.statuses.length === 0;
  return enemy.statuses.includes(status);
}

/** Consume the living-instance projection without changing battle state or its ordering. */
export function selectEnemies(
  view: EnemyInspectionView | null,
  kind: EnemyFilter,
  selectedId: number | undefined,
  order: EnemySort = 'default',
  status: EnemyStatusFilter = 'all',
): EnemySelectionModel {
  const all = view?.enemies ?? [];
  const groups = new Map<EnemyKind, EnemyKindCount>();
  for (const enemy of all) {
    const group = groups.get(enemy.kind);
    if (group) group.count++;
    else groups.set(enemy.kind, { kind: enemy.kind, name: enemy.name, count: 1 });
  }
  const activeKind = kind !== 'all' && groups.has(kind) ? kind : 'all';
  const matchingKind = all.filter((enemy) => activeKind === 'all' || enemy.kind === activeKind);
  const counts: EnemySelectionModel['counts'] = {
    all: matchingKind.length,
    frozen: 0,
    slowed: 0,
    vulnerable: 0,
    unaffected: 0,
  };
  for (const enemy of matchingKind) {
    if (enemy.statuses.length === 0) counts.unaffected++;
    for (const condition of enemy.statuses) counts[condition]++;
  }
  const enemies = sortEnemies(
    matchingKind.filter((enemy) => matchesStatus(enemy, status)),
    order,
  );
  return {
    kinds: [...groups.values()],
    kind: activeKind,
    order,
    status,
    counts,
    enemies,
    selectedId: enemies.find((enemy) => enemy.id === selectedId)?.id ?? enemies[0]?.id,
    total: all.length,
  };
}
