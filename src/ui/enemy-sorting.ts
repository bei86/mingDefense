import type { InspectedEnemy } from './enemy-inspection';

export const enemySortOptions = [
  { value: 'default', label: '默认 · 首领优先' },
  { value: 'hp', label: '当前生命 · 从低到高' },
  { value: 'health', label: '生命比例 · 从低到高' },
] as const;
export type EnemySort = (typeof enemySortOptions)[number]['value'];

function value(enemy: InspectedEnemy, order: EnemySort): number | null {
  if (!Number.isFinite(enemy.hp)) return null;
  if (order !== 'health') return enemy.hp;
  if (enemy.maxHp === null || !Number.isFinite(enemy.maxHp) || enemy.maxHp <= 0) return null;
  const ratio = enemy.hp / enemy.maxHp;
  return Number.isFinite(ratio) ? ratio : null;
}

/** Reorder only the inspection list; missing measurements follow every known value. */
export function sortEnemies(
  enemies: readonly InspectedEnemy[],
  order: EnemySort,
): InspectedEnemy[] {
  return [...enemies].sort((a, b) => {
    if (order === 'default') {
      return Number(b.kind === 'boss') - Number(a.kind === 'boss') || a.id - b.id;
    }
    const av = value(a, order);
    const bv = value(b, order);
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    if (av !== null && bv !== null && av !== bv) return av - bv;
    return a.id - b.id;
  });
}

export function enemySortLabel(enemy: InspectedEnemy, order: EnemySort): string {
  if (order !== 'health') return '';
  const ratio = value(enemy, order);
  return ratio === null ? '比例 未记录' : `比例 ${Math.round(ratio * 1000) / 10}%`;
}
