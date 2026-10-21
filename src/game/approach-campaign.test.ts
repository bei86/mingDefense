import { expect, test } from 'vitest';
import { config } from './content';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import checkpoint from './fixtures/calibration-20-checkpoint.json';

// These fixed buying policies are diagnostic samples, not a proof of optimal play.
// v18 calibrates the first 20 stages. Later stages remain a separate balance task.
test('v18三格规则：72条固定购买策略的真实结果与战报守恒', () => {
  expect(config.waves.spawnRow).toBe(-3);
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 40, true), boost })),
    ),
  );
  const wins = config.stages.map(
    ({ id }) => runs.filter((r) => r.results[id - 1]?.result === 'victory').length,
  );
  expect(wins).toEqual([
    72,
    72,
    72,
    72,
    59,
    59,
    59,
    49,
    49,
    43,
    40,
    40,
    40,
    29,
    22,
    22,
    20,
    15,
    13,
    8,
    8,
    8,
    4,
    4,
    ...Array(16).fill(0),
  ]);
  expect(
    Object.keys(orders).map(
      (policy) =>
        runs.filter((r) => r.policy === policy && r.results[19]?.result === 'victory').length,
    ),
  ).toEqual([1, 5, 2]);
  expect(runs.filter((r) => r.complete)).toHaveLength(0);
  const source = runs.find((r) => r.seed === 20261014 && r.policy === 'control' && !r.boost);
  expect(source).toBeDefined();
  expect(source!.checkpoints[19]).toEqual(checkpoint);
  expect(source!.results[19].result).toBe('victory');
  expect(source!.results[19].report!.boostedMs).toBe(0);
  expect(validSave(checkpoint)).toBe(true);
  for (const run of runs) {
    expect(run.checkpoints.every(validSave)).toBe(true);
    for (const battle of run.results) {
      expect(['victory', 'defeat']).toContain(battle.result);
      expect(battle.time).toBeLessThanOrEqual(180000);
      expect(battle.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(battle.damageDone);
      expect(battle.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(battle.damageTaken);
      expect(battle.enemies!.filter((e) => e.died !== undefined)).toHaveLength(battle.kills);
      if (battle.result === 'victory')
        expect(battle.enemies!.every((e) => e.died !== undefined)).toBe(true);
    }
  }
}, 30000);
