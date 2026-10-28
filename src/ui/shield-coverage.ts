import { center, distance, type HeroId, type Point } from '../game/content';
import type { Ally, Combat } from '../game/combat-model';
import { heroRange } from '../game/combat-skills';

export type ShieldCoverageModel = {
  sourceId: number;
  alive: boolean;
  range: number;
  targets: { id: number; kind: HeroId; rank: number; position: Point }[];
};

export type ShieldSourcesModel = {
  targetId: number;
  alive: boolean;
  sources: { id: number; rank: number; position: Point; range: number }[];
};

function withinShieldRange(source: Ally, target: Ally, range: number): boolean {
  return (
    distance(center(source.kind, source.position), center(target.kind, target.position)) <= range
  );
}

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
  model.targets = battle.allies
    .filter((unit) => unit.hp > 0 && withinShieldRange(source, unit, model.range))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id)
    .map((unit) => ({
      id: unit.id,
      kind: unit.kind,
      rank: unit.rank,
      position: { ...unit.position },
    }));
  return model;
}

/** Reverse range lookup; this does not identify who supplied an existing shield. */
export function shieldSources(battle: Combat | null, targetId: number): ShieldSourcesModel | null {
  const target = battle?.allies.find((unit) => unit.id === targetId);
  if (!battle || !target) return null;
  const model: ShieldSourcesModel = { targetId, alive: target.hp > 0, sources: [] };
  if (!model.alive) return model;
  model.sources = battle.allies
    .filter((unit) => unit.kind === 'shield_fox' && unit.hp > 0)
    .map((unit) => ({ unit, range: heroRange(unit, battle.progression) }))
    .filter(({ unit, range }) => withinShieldRange(unit, target, range))
    .sort(
      (a, b) =>
        a.unit.position.y - b.unit.position.y ||
        a.unit.position.x - b.unit.position.x ||
        a.unit.id - b.unit.id,
    )
    .map(({ unit, range }) => ({
      id: unit.id,
      rank: unit.rank,
      position: { ...unit.position },
      range,
    }));
  return model;
}
