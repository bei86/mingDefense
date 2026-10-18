import type { Combat, Enemy } from './combat-model';
import type { EnemyKind } from './content';

export type EnemyLifetime = {
  id: number;
  kind: EnemyKind;
  owner?: number;
  born: number;
  died?: number;
};

// Opt-in, transient observations: never serialized or used by gameplay/RNG.
const observations = new WeakMap<Combat, EnemyLifetime[]>();

export function observeEnemies(s: Combat): EnemyLifetime[] {
  const existing = observations.get(s);
  if (existing) return existing;
  const events: EnemyLifetime[] = [];
  observations.set(s, events);
  for (const enemy of s.enemies) recordEnemyBirth(s, enemy);
  return events;
}

export function recordEnemyBirth(s: Combat, enemy: Enemy): void {
  observations.get(s)?.push({
    id: enemy.id,
    kind: enemy.kind ?? 'wolf',
    owner: enemy.owner,
    born: enemy.born ?? s.time,
  });
}

export function recordEnemyDeath(s: Combat, enemy: Enemy): void {
  const event = observations.get(s)?.find((e) => e.id === enemy.id);
  if (event) event.died = s.time;
}
