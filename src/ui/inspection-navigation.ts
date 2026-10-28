type Entry = { id: number };
type Neighbors = {
  position: number;
  total: number;
  previousId: number | undefined;
  nextId: number | undefined;
};

/** Follow the already filtered/sorted list without mutating it or inventing a selection. */
export function inspectionNeighbors(
  entries: readonly Entry[],
  selectedId: number | undefined,
): Neighbors | null {
  if (entries.length <= 1) return null;
  const index = entries.findIndex((entry) => entry.id === selectedId);
  if (index < 0) return null;
  return {
    position: index + 1,
    total: entries.length,
    previousId: entries[index - 1]?.id,
    nextId: entries[index + 1]?.id,
  };
}
