import type { EnemyKind } from '../game/content';
import type { EnemyInspectionView, InspectedEnemy } from './enemy-inspection';

export type EnemyFilter = EnemyKind | 'all';
type EnemyKindCount = { kind: EnemyKind; name: string; count: number };
type EnemySelection = {
  kinds: EnemyKindCount[];
  kind: EnemyFilter;
  enemies: InspectedEnemy[];
  selectedId: number | undefined;
  total: number;
};

/** Consume the living-instance projection without changing battle state or its ordering. */
export function selectEnemies(
  view: EnemyInspectionView | null,
  kind: EnemyFilter,
  selectedId: number | undefined,
): EnemySelection {
  const all = view?.enemies ?? [];
  const groups = new Map<EnemyKind, EnemyKindCount>();
  for (const enemy of all) {
    const group = groups.get(enemy.kind);
    if (group) group.count++;
    else groups.set(enemy.kind, { kind: enemy.kind, name: enemy.name, count: 1 });
  }
  const activeKind = kind !== 'all' && groups.has(kind) ? kind : 'all';
  const enemies = all.filter((enemy) => activeKind === 'all' || enemy.kind === activeKind);
  return {
    kinds: [...groups.values()],
    kind: activeKind,
    enemies,
    selectedId: enemies.find((enemy) => enemy.id === selectedId)?.id ?? enemies[0]?.id,
    total: all.length,
  };
}
