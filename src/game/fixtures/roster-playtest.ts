import { Session } from '../session';
import type { Unit } from '../model';

// Fixed skill/footprint fixture, deliberately separate from normal economy simulations.
export function rosterPlaytest(): Session {
  const session = new Session(20261016);
  const roster: [Unit['kind'], number, number, number][] = [
    ['fortune_peach', 3, 0, 2],
    ['ember_mouse', 3, 1, 2],
    ['boar', 3, 2, 2],
    ['shield_fox', 3, 4, 2],
    ['scatter_bear', 3, 0, 3],
    ['ice_fish', 3, 1, 3],
    ['piercing_monkey', 5, 2, 3],
    ['sword_eagle', 3, 3, 4],
  ];
  session.preparation.unlocked = Array.from(
    { length: 36 },
    (_, i) => `${i % 6},${Math.floor(i / 6)}`,
  );
  session.preparation.units = roster.map(([kind, rank, x, y], i) => ({
    id: i + 5,
    kind,
    rank,
    position: { x, y },
  }));
  session.preparation.nextId = 13;
  session.preparation.offers.forEach((o) => {
    o.claimed = true;
  });
  return session;
}

/** Fixed full-board arena for approach/camera QA; never a normal economy claim. */
export function approachPlaytest(): Session {
  const session = rosterPlaytest();
  session.preparation.stageId = 40;
  session.preparation.rewardedStages = Array.from({ length: 39 }, (_, i) => i + 1);
  session.preparation.units = Array.from({ length: 36 }, (_, i) => ({
    id: i + 5,
    kind: 'ember_mouse',
    rank: 6,
    position: { x: i % 6, y: Math.floor(i / 6) },
  }));
  session.preparation.nextId = 41;
  return session;
}
