import { useLegacyApproach } from './testing/legacy-approach';
import { expect, test } from 'vitest';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import thirtySixthCheckpoint from './fixtures/stage-36-checkpoint.json';
import fortiethCheckpoint from './fixtures/stage-40-checkpoint.json';

useLegacyApproach();

test('历史1格规则：四十关72条合法经济路线、检查点及前三十五关回归', () => {
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 40, true), boost })),
    ),
  );
  const wins = Array.from(
    { length: 40 },
    (_, i) => runs.filter((r) => r.results[i]?.result === 'victory').length,
  );
  expect(wins.slice(0, 35)).toEqual([
    72, 72, 72, 72, 59, 59, 59, 53, 49, 45, 45, 45, 45, 41, 28, 28, 28, 28, 28, 22, 22, 22, 21, 21,
    11, 11, 11, 10, 9, 5, 5, 5, 5, 5, 5,
  ]);
  expect(wins.slice(35)).toEqual([5, 5, 5, 5, 4]);
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
  expect(viable.checkpoints[35]).toEqual(thirtySixthCheckpoint);
  expect(viable.checkpoints[39]).toEqual(fortiethCheckpoint);
}, 30000);
