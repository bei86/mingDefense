import type { InspectedAlly } from './battle-inspection';

export const allySortOptions = [
  { value: 'position', label: '站位 · 从前到后', metric: '' },
  { value: 'health', label: '生命比例 · 从低到高', metric: '生命' },
  { value: 'targeted', label: '锁定数量 · 从高到低', metric: '锁定' },
  { value: 'damageDone', label: '本关伤害 · 从高到低', metric: '伤害' },
  { value: 'damageTaken', label: '本关承伤 · 从高到低', metric: '承伤' },
  { value: 'shieldGiven', label: '提供护盾 · 从高到低', metric: '施盾' },
  { value: 'shieldAbsorbed', label: '护盾吸收 · 从高到低', metric: '吸盾' },
  { value: 'income', label: '本关产钱 · 从高到低', metric: '产钱' },
] as const;
export type AllySort = (typeof allySortOptions)[number]['value'];

function value(unit: InspectedAlly, order: AllySort): number | null {
  let result: number | undefined;
  if (order === 'position') return null;
  if (order === 'health') {
    if (!unit.alive) return 0;
    if (!Number.isFinite(unit.maxHp) || unit.maxHp <= 0) return null;
    result = unit.hp / unit.maxHp;
  } else if (order === 'targeted') result = unit.targetedBy;
  else result = unit.stats?.[order];
  return result !== undefined && Number.isFinite(result) ? result : null;
}

function byPosition(a: InspectedAlly, b: InspectedAlly): number {
  return a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id;
}

/** Sort a copy of the filtered projection; missing observations follow every real value. */
export function sortAllies(allies: readonly InspectedAlly[], order: AllySort): InspectedAlly[] {
  return [...allies].sort((a, b) => {
    if (order === 'position') return byPosition(a, b);
    const av = value(a, order);
    const bv = value(b, order);
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    if (av !== null && bv !== null && av !== bv) return order === 'health' ? av - bv : bv - av;
    return byPosition(a, b);
  });
}

export function allySortLabel(unit: InspectedAlly, order: AllySort): string {
  if (order === 'position') return '';
  const metric = allySortOptions.find((option) => option.value === order)!.metric;
  const current = value(unit, order);
  if (current === null) return `${metric} 未记录`;
  if (order === 'health') return `${metric} ${Math.round(current * 1000) / 10}%`;
  if (order === 'targeted') return `${metric} ${Math.floor(current)}只`;
  return `${metric} ${Math.floor(current)}`;
}
