import { appearances } from '../game/content';
import type { InspectedAlly } from './battle-inspection';

export type AllyKindFilter = InspectedAlly['kind'] | 'all';
export type AllyStatusFilter = 'all' | 'alive' | 'fallen';
export type AllySelectionModel = {
  kinds: { kind: InspectedAlly['kind']; name: string; count: number }[];
  kind: AllyKindFilter;
  status: AllyStatusFilter;
  counts: Record<AllyStatusFilter, number>;
  allies: InspectedAlly[];
  selectedId: number | undefined;
  total: number;
};

/** Filter only the inspection projection; preserve battle/formation ordering and state. */
export function selectAllies(
  allies: readonly InspectedAlly[] | null,
  kind: AllyKindFilter,
  status: AllyStatusFilter,
  selectedId: number | undefined,
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
  const matching = matchingKind.filter(
    (unit) => status === 'all' || (status === 'alive' ? unit.alive : !unit.alive),
  );
  return {
    kinds: [...groups.values()],
    kind: activeKind,
    status,
    counts: { all: matchingKind.length, alive, fallen: matchingKind.length - alive },
    allies: matching,
    selectedId: matching.find((unit) => unit.id === selectedId)?.id ?? matching[0]?.id,
    total: all.length,
  };
}
