import { center, distance, type HeroId, type Point } from '../game/content';
import type { Combat } from '../game/combat-model';
import { heroRange } from '../game/combat-skills';

export type ShieldCoverageModel = {
  sourceId: number;
  alive: boolean;
  range: number;
  targets: { id: number; kind: HeroId; rank: number; position: Point }[];
};

/** Range candidates only; shieldTarget still selects the actual next action target. */
export function shieldCoverage(
  battle: Combat | null,
  sourceId: number,
): ShieldCoverageModel | null {
  const source = battle?.allies.find((unit) => unit.id === sourceId);
  if (!battle || !source || source.kind !== 'shield_fox') return null;
  const model: ShieldCoverageModel = {
    sourceId,
    alive: source.hp > 0,
    range: heroRange(source, battle.progression),
    targets: [],
  };
  if (!model.alive) return model;
  const origin = center(source.kind, source.position);
  model.targets = battle.allies
    .filter(
      (unit) => unit.hp > 0 && distance(origin, center(unit.kind, unit.position)) <= model.range,
    )
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id)
    .map((unit) => ({
      id: unit.id,
      kind: unit.kind,
      rank: unit.rank,
      position: { ...unit.position },
    }));
  return model;
}
