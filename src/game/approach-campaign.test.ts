import { expect, test } from 'vitest';
import { config } from './content';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';
import checkpoint from './fixtures/calibration-20-checkpoint.json';
import checkpoint25 from './fixtures/calibration-25-checkpoint.json';
import checkpoint30 from './fixtures/calibration-30-checkpoint.json';
import checkpoint35 from './fixtures/calibration-35-checkpoint.json';
import checkpoint40 from './fixtures/calibration-40-checkpoint.json';
import checkpoint41 from './fixtures/stage-41-checkpoint.json';
import checkpoint45 from './fixtures/stage-45-checkpoint.json';
import checkpoint46 from './fixtures/stage-46-checkpoint.json';
import checkpoint50 from './fixtures/stage-50-checkpoint.json';

// These fixed buying policies are diagnostic samples, not a proof of optimal play.
// v24 preserves the first 45 stages and adds 46–50. Fixed samples are not player win rates.
test('v24三格规则：50关72条合法购买路线、前45回归和战报守恒', () => {
  expect(config.waves.spawnRow).toBe(-3);
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 50, true), boost })),
    ),
  );
  const wins = config.stages
    .slice(0, 40)
    .map(({ id }) => runs.filter((r) => r.results[id - 1]?.result === 'victory').length);
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
  expect(
    config.stages
      .slice(40)
      .map(({ id }) => runs.filter((r) => r.results[id - 1]?.result === 'victory').length),
  ).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  expect(source25.checkpoints[40]).toEqual(checkpoint41);
  expect(source25.checkpoints[44]).toEqual(checkpoint45);
  expect(source25.results.slice(40, 45).map((b) => [b.time, b.hp])).toEqual([
    [41500, 11192],
    [36500, 16380],
    [43400, 16045],
    [41550, 11288],
    [68450, 12559],
  ]);
  expect(validSave(checkpoint41)).toBe(true);
  expect(validSave(checkpoint45)).toBe(true);
  expect(source25.checkpoints[45]).toEqual(checkpoint46);
  expect(source25.checkpoints[49]).toEqual(checkpoint50);
  expect(source25.results.slice(45).map((b) => [b.time, b.hp])).toEqual([
    [44450, 11500],
    [40150, 15597],
    [48200, 9618],
    [47150, 11923],
    [83850, 9996],
  ]);
  expect(validSave(checkpoint46)).toBe(true);
  expect(validSave(checkpoint50)).toBe(true);
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
