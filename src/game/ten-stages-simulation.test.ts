import { expect, test } from 'vitest';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import { config } from './content';
import sixthCheckpoint from './fixtures/stage-6-checkpoint.json';
import tenthCheckpoint from './fixtures/stage-10-checkpoint.json';
import eighthCheckpoint from './fixtures/stage-8-checkpoint.json';

test('十关正常经济样本与开发检查点', () => {
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 10, true), boost })),
    ),
  );
  const summary = {
    contentVersion: config.contentVersion,
    runs: runs.length,
    reachedSix: runs.filter((r) => r.results.length >= 6).length,
    reachedTen: runs.filter((r) => r.results.length === 10).length,
    completed: runs.filter((r) => r.complete).length,
  };
  console.log(JSON.stringify(summary));
  for (const r of runs) {
    expect(r.checkpoints.every(validSave)).toBe(true);
    for (const b of r.results) {
      expect(b.time).toBeLessThanOrEqual(180000);
      expect(b.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(b.damageDone);
      expect(b.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(b.damageTaken);
      expect(b.enemies!.filter((e) => e.died !== undefined)).toHaveLength(b.kills);
      if (b.result === 'victory') expect(b.enemies!.every((e) => e.died !== undefined)).toBe(true);
    }
  }
  expect(summary.reachedSix).toBeGreaterThan(0);
  expect(summary.completed).toBeGreaterThan(0);
  for (const policy of Object.keys(orders))
    expect(runs.some((r) => r.policy === policy && r.complete)).toBe(true);
  expect(runs[0].checkpoints[5]).toEqual(sixthCheckpoint);
  expect(runs[0].checkpoints[9]).toEqual(tenthCheckpoint);
  const summonRoute = runs.find(
    (r) => r.complete && !r.boost && r.results[7].enemies!.some((e) => e.kind === 'summoned_wolf'),
  )!;
  expect(summonRoute.checkpoints[7]).toEqual(eighthCheckpoint);
}, 30000);
