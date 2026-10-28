import { appearances } from '../game/content';
import type { InspectedAlly } from './battle-inspection';
import { sortAllies, type AllySort } from './ally-sorting';

export type AllyKindFilter = InspectedAlly['kind'] | 'all';
export type AllyStatusFilter = 'all' | 'alive' | 'fallen' | 'shielded' | 'unshielded';
export type AllySelectionModel = {
  kinds: { kind: InspectedAlly['kind']; name: string; count: number }[];
  kind: AllyKindFilter;
  status: AllyStatusFilter;
  order: AllySort;
  counts: Record<AllyStatusFilter, number>;
  allies: InspectedAlly[];
  selectedId: number | undefined;
  total: number;
};

function matchesStatus(unit: InspectedAlly, status: AllyStatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'alive':
      return unit.alive;
    case 'fallen':
      return !unit.alive;
    case 'shielded':
      return unit.alive && unit.shield > 0;
    case 'unshielded':
      return unit.alive && unit.shield <= 0;
  }
}

/** Filter/sort only the inspection projection; leave battle/formation ordering and state intact. */
export function selectAllies(
  allies: readonly InspectedAlly[] | null,
  kind: AllyKindFilter,
  status: AllyStatusFilter,
  selectedId: number | undefined,
  order: AllySort = 'position',
): AllySelectionModel {
  const all = allies ?? [];
  const groups = new Map<InspectedAlly['kind'], AllySelectionModel['kinds'][number]>();
  for (const unit of all) {
    const group = groups.get(unit.kind);
    if (group) group.count++;
    else groups.set(unit.kind, { kind: unit.kind, name: appearances[unit.kind].name, count: 1 });
  }
  const activeKind = kind !== 'all' && groups.has(kind) ? kind : 'all';
  const matchingKind = all.filter((unit) => activeKind === 'all' || unit.kind === activeKind);
  const alive = matchingKind.filter((unit) => unit.alive).length;
  const shielded = matchingKind.filter((unit) => matchesStatus(unit, 'shielded')).length;
  const matching = sortAllies(
    matchingKind.filter((unit) => matchesStatus(unit, status)),
    order,
  );
  return {
    kinds: [...groups.values()],
    kind: activeKind,
    status,
    order,
    counts: {
      all: matchingKind.length,
      alive,
      fallen: matchingKind.length - alive,
      shielded,
      unshielded: alive - shielded,
    },
    allies: matching,
    selectedId: matching.find((unit) => unit.id === selectedId)?.id ?? matching[0]?.id,
    total: all.length,
  };
}
