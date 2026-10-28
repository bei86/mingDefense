import type { Ally, Combat } from '../game/combat-model';

export type IncomingAttack = {
  source: Pick<Ally, 'id' | 'kind' | 'rank' | 'position'>;
  ordinal: number;
  remainingMs: number;
};

/** Direct prepared targets only; released projectiles and area effects are separate. */
export function incomingAttacks(battle: Combat | null, enemyId: number): IncomingAttack[] {
  if (!battle?.enemies.some((enemy) => enemy.id === enemyId && enemy.hp > 0)) return [];
  const sources = new Map(
    battle.allies
      .filter((ally) => ally.hp > 0 && ally.kind !== 'shield_fox' && ally.kind !== 'fortune_peach')
      .map((ally) => [ally.id, ally]),
  );
  return battle.attacks
    .filter(
      (attack) => attack.team === 'ally' && attack.target === enemyId && sources.has(attack.source),
    )
    .sort((a, b) => a.due - b.due || a.source - b.source || a.ordinal - b.ordinal)
    .map((attack) => {
      const source = sources.get(attack.source)!;
      return {
        source: {
          id: source.id,
          kind: source.kind,
          rank: source.rank,
          position: { ...source.position },
        },
        ordinal: attack.ordinal,
        remainingMs: Math.max(0, attack.due - battle.time),
      };
    });
}
