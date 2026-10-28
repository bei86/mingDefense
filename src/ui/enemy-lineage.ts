import type { EnemyInspectionView, InspectedEnemy } from './enemy-inspection';

type RelatedEnemy = Pick<InspectedEnemy, 'id' | 'name' | 'hp'>;
export type EnemyLineageModel = {
  origin: string | null;
  source: RelatedEnemy | null;
  children: RelatedEnemy[];
};

function reference(enemy: InspectedEnemy): RelatedEnemy {
  return { id: enemy.id, name: enemy.name, hp: enemy.hp };
}

/** Use the full living-instance projection, independent of the current kind filter. */
export function enemyLineage(
  view: EnemyInspectionView | null,
  enemyId: number,
): EnemyLineageModel | null {
  const enemy = view?.enemies.find((entry) => entry.id === enemyId);
  if (!view || !enemy) return null;
  const source = view.enemies.find((entry) => entry.id === enemy.ownerId);
  return {
    origin: enemy.origin,
    source: source ? reference(source) : null,
    children: view.enemies.filter((entry) => entry.ownerId === enemy.id).map(reference),
  };
}
