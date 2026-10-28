import type { Ally, Combat } from '../game/combat-model';

export type IncomingShield = {
  source: Pick<Ally, 'id' | 'kind' | 'rank' | 'position'>;
  ordinal: number;
  remainingMs: number;
};

/** Read prepared shield targets, independently of range, existing shields or attack locks. */
export function incomingShields(battle: Combat | null, unitId: number): IncomingShield[] {
  if (!battle?.allies.some((ally) => ally.id === unitId && ally.hp > 0)) return [];
  const sources = new Map(
    battle.allies
      .filter((ally) => ally.kind === 'shield_fox' && ally.hp > 0)
      .map((ally) => [ally.id, ally]),
  );
  return battle.attacks
    .filter(
      (action) => action.team === 'ally' && action.target === unitId && sources.has(action.source),
    )
    .sort((a, b) => a.due - b.due || a.source - b.source || a.ordinal - b.ordinal)
    .map((action) => {
      const source = sources.get(action.source)!;
      return {
        source: {
          id: source.id,
          kind: source.kind,
          rank: source.rank,
          position: { ...source.position },
        },
        ordinal: action.ordinal,
        remainingMs: Math.max(0, action.due - battle.time),
      };
    });
}
