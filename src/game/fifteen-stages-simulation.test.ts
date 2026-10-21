import { useLegacyApproach } from './testing/legacy-approach';
import { expect, test } from 'vitest';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import eleventhCheckpoint from './fixtures/stage-11-checkpoint.json';
import fifteenthCheckpoint from './fixtures/stage-15-checkpoint.json';

useLegacyApproach();

test('历史1格规则：十五关72条合法经济路线、可复现检查点和前十关回归', () => {
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({
        ...simulate(seed, policy, boost, 15, true),
        boost,
      })),
    ),
  );
  const reached = Array.from(
    { length: 15 },
    (_, i) => runs.filter((r) => r.results.length > i).length,
  );
  const wins = Array.from(
    { length: 15 },
    (_, i) => runs.filter((r) => r.results[i]?.result === 'victory').length,
  );
  // v9 fixed-seed aggregate, pinned to guard old campaign and RNG behavior.
  expect(wins.slice(0, 10)).toEqual([72, 72, 72, 72, 59, 59, 59, 53, 49, 45]);
  expect(reached.slice(10)).toEqual([45, 45, 45, 45, 41]);
  expect(wins.slice(10)).toEqual([45, 45, 45, 41, 28]);
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
  expect(viable.checkpoints[10]).toEqual(eleventhCheckpoint);
  expect(viable.checkpoints[14]).toEqual(fifteenthCheckpoint);
}, 30000);
