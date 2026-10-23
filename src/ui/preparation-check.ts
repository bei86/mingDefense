import { cells, config, heroes, key, type HeroId, type Point } from '../game/content';
import { maxHeroHp } from '../game/combat-skills';
import {
  expansionError,
  mergeError,
  placementError,
  type Preparation,
  type Source,
} from '../game/session';

export type PreparationCheckItem = {
  source: Source;
  kind: HeroId | 'cell';
  rank: number | null;
  origin: 'reserve' | 'offer';
  placements: number;
  mergeTargets: number;
};

export type PreparationCheckModel = {
  deployedCount: number;
  attackerCount: number;
  deployedHp: number;
  emptyCells: number;
  items: PreparationCheckItem[];
};

/** Inspect current preparation only; no commands, simulation, or random draws. */
export function preparationCheck(p: Preparation, maxRank: number): PreparationCheckModel {
  const deployed = p.units.filter((unit) => unit.position);
  const occupied = new Set(deployed.flatMap((unit) => cells(unit.kind, unit.position!).map(key)));
  const points: Point[] = [];
  for (let y = 0; y < config.board.rows; y++) {
    for (let x = 0; x < config.board.columns; x++) points.push({ x, y });
  }
  const items: PreparationCheckItem[] = [
    ...p.units
      .filter((unit) => !unit.position)
      .map((unit) => ({
        source: { type: 'unit' as const, id: unit.id },
        kind: unit.kind,
        rank: unit.rank,
        origin: 'reserve' as const,
        placements: 0,
        mergeTargets: 0,
      })),
    ...p.offers
      .filter((offer) => !offer.claimed)
      .map((offer) => ({
        source: { type: 'offer' as const, id: offer.id },
        kind: offer.kind,
        rank: offer.kind === 'cell' ? null : (offer.rank ?? 1),
        origin: 'offer' as const,
        placements: 0,
        mergeTargets: 0,
      })),
  ];
  for (const item of items) {
    const kind = item.kind;
    item.placements = points.filter((point) =>
      kind === 'cell' ? !expansionError(p, point) : !placementError(p, kind, point),
    ).length;
    if (kind !== 'cell') {
      item.mergeTargets = p.units.filter(
        (unit) => !mergeError(p, item.source, unit.id, maxRank),
      ).length;
    }
  }
  return {
    deployedCount: deployed.length,
    attackerCount: deployed.filter((unit) => heroes[unit.kind].hitDamage[unit.rank - 1] > 0).length,
    deployedHp: deployed.reduce((sum, unit) => sum + maxHeroHp(unit, p.progression), 0),
    emptyCells: p.unlocked.filter((cell) => !occupied.has(cell)).length,
    items,
  };
}
