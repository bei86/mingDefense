import type { Combat, UnitBattleStats } from '../game/combat-model';
import type { Unit } from '../game/model';

export type InspectedAlly = {
  id: number;
  kind: Unit['kind'];
  rank: number;
  position: NonNullable<Unit['position']>;
  alive: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  shieldSeconds: number;
  targetedBy: number;
  stats: Omit<UnitBattleStats, 'id'> | null;
};

/** Read the current battle only; cached enemy targets are observations, not predictions. */
export function battleInspection(battle: Combat | null, units: readonly Unit[]) {
  if (!battle) return null;
  const enemies = battle.enemies.filter((enemy) => enemy.hp > 0);
  const allies: InspectedAlly[] = battle.allies
    .map((unit) => {
      const alive = unit.hp > 0;
      const shield = alive && (unit.shieldExpires ?? 0) > battle.time ? (unit.shield ?? 0) : 0;
      const recorded = battle.report?.units.find((entry) => entry.id === unit.id);
      return {
        id: unit.id,
        kind: unit.kind,
        rank: unit.rank,
        position: { ...unit.position },
        alive,
        hp: Math.max(0, Math.ceil(unit.hp)),
        maxHp: unit.maxHp,
        shield: Math.max(0, Math.ceil(shield)),
        shieldSeconds: shield > 0 ? Math.ceil((unit.shieldExpires! - battle.time) / 1000) : 0,
        targetedBy: alive ? enemies.filter((enemy) => enemy.target === unit.id).length : 0,
        stats: recorded
          ? {
              damageDone: recorded.damageDone,
              damageTaken: recorded.damageTaken,
              income: recorded.income,
              shieldGiven: recorded.shieldGiven,
              shieldAbsorbed: recorded.shieldAbsorbed,
            }
          : null,
      };
    })
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id);
  const alive = allies.filter((unit) => unit.alive);
  const focused = [...alive].sort((a, b) => b.targetedBy - a.targetedBy)[0];
  return {
    time: battle.time,
    enemyCount: enemies.length,
    aliveCount: alive.length,
    allies,
    initialId: focused?.id ?? allies[0]?.id,
    reserves: units
      .filter((unit) => unit.position === null)
      .map(({ id, kind, rank }) => ({ id, kind, rank })),
  };
}
