import { cells, type HeroId, type Point } from '../game/content';
import { swapError, type Preparation } from '../game/session';

export type ReserveUpgrade = {
  reserve: { id: number; kind: HeroId; rank: number };
  targets: { id: number; rank: number; position: Point; cells: Point[] }[];
};

/** Read-only independent swap candidates; no simulation or automatic replacement. */
export function reserveUpgrades(p: Preparation): ReserveUpgrade[] {
  const upgrades: ReserveUpgrade[] = [];
  const reserves = p.units
    .filter((u) => !u.position)
    .sort((a, b) => b.rank - a.rank || a.id - b.id);
  for (const reserve of reserves) {
    const targets = p.units
      .filter(
        (u) =>
          u.position &&
          u.kind === reserve.kind &&
          u.rank < reserve.rank &&
          !swapError(p, reserve.id, u.id),
      )
      .sort((a, b) => a.rank - b.rank || a.id - b.id)
      .map((u) => ({
        id: u.id,
        rank: u.rank,
        position: { ...u.position! },
        cells: cells(u.kind, u.position!),
      }));
    if (targets.length)
      upgrades.push({
        reserve: { id: reserve.id, kind: reserve.kind, rank: reserve.rank },
        targets,
      });
  }
  return upgrades;
}
