import { expect, test } from 'vitest';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import thirtyFirstCheckpoint from './fixtures/stage-31-checkpoint.json';
import thirtyFifthCheckpoint from './fixtures/stage-35-checkpoint.json';

test('三十五关72条合法经济路线、检查点及前三十关回归', () => {
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 35, true), boost })),
    ),
  );
  const wins = Array.from(
    { length: 35 },
    (_, i) => runs.filter((r) => r.results[i]?.result === 'victory').length,
  );
  expect(wins.slice(0, 30)).toEqual([
    72, 72, 72, 72, 59, 59, 59, 53, 49, 45, 45, 45, 45, 41, 28, 28, 28, 28, 28, 22, 22, 22, 21, 21,
    11, 11, 11, 10, 9, 5,
  ]);
  expect(wins.slice(30)).toEqual([5, 5, 5, 5, 5]);
  for (const policy of Object.keys(orders))
    expect(runs.some((r) => r.policy === policy && r.complete)).toBe(true);
  for (const run of runs) {
    expect(run.checkpoints.every(validSave)).toBe(true);
    for (const b of run.results) {
      expect(b.time).toBeLessThanOrEqual(180000);
      expect(b.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(b.damageDone);
      expect(b.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(b.damageTaken);
      expect(b.enemies!.filter((e) => e.died !== undefined)).toHaveLength(b.kills);
      if (b.result === 'victory') expect(b.enemies!.every((e) => e.died !== undefined)).toBe(true);
    }
  }
  const viable = runs.find((r) => r.complete)!;
  expect(viable.checkpoints[30]).toEqual(thirtyFirstCheckpoint);
  expect(viable.checkpoints[34]).toEqual(thirtyFifthCheckpoint);
}, 30000);
