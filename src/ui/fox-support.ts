import { cells, center, distance, heroes, type HeroId, type Point } from '../game/content';
import { heroRange } from '../game/combat-skills';
import type { Preparation, Unit } from '../game/session';

export type FoxSource = { id: number; rank: number; position: Point };
export type FoxSupportUnit = {
  id: number;
  kind: HeroId;
  rank: number;
  position: Point;
  cells: Point[];
  front: boolean;
  attacker: boolean;
  shieldSources: FoxSource[];
  auraSources: FoxSource[];
};
export type FoxSupportModel = {
  foxCount: number;
  auraFoxCount: number;
  frontRow: number | null;
  frontCount: number;
  shieldReachableCount: number;
  shieldReachableFrontCount: number;
  attackerCount: number;
  auraAttackerCount: number;
  units: FoxSupportUnit[];
};

/** Static opening reach, not the order or amount of shields actually assigned. */
export function foxSupport(p: Preparation): FoxSupportModel {
  const deployed = p.units
    .filter((u): u is Unit & { position: Point } => u.position !== null)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id);
  const foxes = deployed.filter((u) => u.kind === 'shield_fox').sort((a, b) => a.id - b.id);
  const skill = heroes.shield_fox.skills;
  const frontRow = deployed[0]?.position.y ?? null;
  const units = deployed.map((u): FoxSupportUnit => {
    const point = center(u.kind, u.position);
    const attacker = u.kind !== 'fortune_peach' && u.kind !== 'shield_fox';
    const shieldSources: FoxSource[] = [];
    const auraSources: FoxSource[] = [];
    for (const fox of foxes) {
      const d = distance(center(fox.kind, fox.position), point);
      if (d <= heroRange(fox, p.progression))
        shieldSources.push({ id: fox.id, rank: fox.rank, position: { ...fox.position } });
      if (attacker && fox.rank >= skill.auraFromRank! && d <= skill.auraRadiusCells!)
        auraSources.push({ id: fox.id, rank: fox.rank, position: { ...fox.position } });
    }
    return {
      id: u.id,
      kind: u.kind,
      rank: u.rank,
      position: { ...u.position },
      cells: cells(u.kind, u.position),
      front: u.position.y === frontRow,
      attacker,
      shieldSources,
      auraSources,
    };
  });
  return {
    foxCount: foxes.length,
    auraFoxCount: foxes.filter((u) => u.rank >= skill.auraFromRank!).length,
    frontRow,
    frontCount: units.filter((u) => u.front).length,
    shieldReachableCount: units.filter((u) => u.shieldSources.length > 0).length,
    shieldReachableFrontCount: units.filter((u) => u.front && u.shieldSources.length > 0).length,
    attackerCount: units.filter((u) => u.attacker).length,
    auraAttackerCount: units.filter((u) => u.auraSources.length > 0).length,
    units,
  };
}
