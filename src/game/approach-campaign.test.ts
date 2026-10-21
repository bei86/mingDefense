import { expect, test } from 'vitest';
import { config } from './content';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import checkpoint from './fixtures/calibration-20-checkpoint.json';
import checkpoint25 from './fixtures/calibration-25-checkpoint.json';
import checkpoint30 from './fixtures/calibration-30-checkpoint.json';
import checkpoint35 from './fixtures/calibration-35-checkpoint.json';
import checkpoint40 from './fixtures/calibration-40-checkpoint.json';

// These fixed buying policies are diagnostic samples, not a proof of optimal play.
// v22 additionally calibrates stages 37/39/40. Fixed samples do not imply player win rates.
test('v22三格规则：72条固定购买策略的真实结果与战报守恒', () => {
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
    72, 72, 72, 72, 59, 59, 59, 49, 49, 43, 40, 40, 40, 29, 22, 22, 20, 15, 13, 8, 8, 8, 4, 4, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  ]);
  expect(
    Object.keys(orders).map(
      (policy) =>
        runs.filter((r) => r.policy === policy && r.results[19]?.result === 'victory').length,
    ),
  ).toEqual([1, 5, 2]);
  expect(runs.filter((r) => r.complete)).toHaveLength(2);
  const source = runs.find((r) => r.seed === 20261014 && r.policy === 'control' && !r.boost);
  expect(source).toBeDefined();
  expect(source!.checkpoints[19]).toEqual(checkpoint);
  expect(source!.results[19].result).toBe('victory');
  expect(source!.results[19].report!.boostedMs).toBe(0);
  expect(validSave(checkpoint)).toBe(true);
  expect(
    Object.keys(orders).map(
      (policy) =>
        runs.filter((r) => r.policy === policy && r.results[24]?.result === 'victory').length,
    ),
  ).toEqual([0, 1, 1]);
  const source25 = runs.find((r) => r.seed === 20261022 && r.policy === 'control' && !r.boost)!;
  expect(source25.checkpoints[24]).toEqual(checkpoint25);
  expect(source25.results[24].result).toBe('victory');
  expect(source25.results[24].report!.boostedMs).toBe(0);
  expect(validSave(checkpoint25)).toBe(true);
  expect(
    Object.keys(orders).map(
      (policy) =>
        runs.filter((r) => r.policy === policy && r.results[29]?.result === 'victory').length,
    ),
  ).toEqual([0, 1, 1]);
  expect(source25.checkpoints[29]).toEqual(checkpoint30);
  expect(source25.results[29].result).toBe('victory');
  expect(source25.results[29].report!.boostedMs).toBe(0);
  expect(validSave(checkpoint30)).toBe(true);
  expect(
    Object.keys(orders).map(
      (policy) =>
        runs.filter((r) => r.policy === policy && r.results[34]?.result === 'victory').length,
    ),
  ).toEqual([0, 1, 1]);
  expect(source25.checkpoints[34]).toEqual(checkpoint35);
  expect(source25.results[34].result).toBe('victory');
  expect(source25.results[34].report!.boostedMs).toBe(0);
  expect(validSave(checkpoint35)).toBe(true);
  expect(
    Object.keys(orders).map(
      (policy) => runs.filter((r) => r.policy === policy && r.complete).length,
    ),
  ).toEqual([0, 1, 1]);
  expect(source25.checkpoints[39]).toEqual(checkpoint40);
  expect(source25.results[39].result).toBe('victory');
  expect(source25.results[39].report!.boostedMs).toBe(0);
  expect(source25.complete).toBe(true);
  expect(validSave(checkpoint40)).toBe(true);
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
