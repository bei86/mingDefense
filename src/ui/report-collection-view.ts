import type { CollectedReport } from './report-collection';

export type ReportCollectionFilter = {
  stageId: number | null;
  result: 'all' | 'victory' | 'defeat';
};

export function reportCollectionView(
  collection: readonly CollectedReport[],
  filter: Readonly<ReportCollectionFilter>,
  selectedId?: number,
): { entries: CollectedReport[]; selected: CollectedReport | undefined } {
  const entries = collection.filter(
    (entry) =>
      (filter.stageId === null || entry.stageId === filter.stageId) &&
      (filter.result === 'all' || entry.result === filter.result),
  );
  return { entries, selected: entries.find((entry) => entry.id === selectedId) ?? entries[0] };
}
