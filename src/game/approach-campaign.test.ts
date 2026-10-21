import { expect, test } from 'vitest';
import { config } from './content';
import { simulate, orders } from './testing/campaign-simulation';
import { validSave } from './persistence';

// These fixed buying policies are diagnostic samples, not a proof of optimal play.
// v17 currently has a stage-20 balance bottleneck; keep that visible instead of
// reusing the old one-cell campaign's completion claims.
test('v17三格规则：72条固定购买策略的真实结果与战报守恒', () => {
  expect(config.waves.spawnRow).toBe(-3);
  const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
    Object.keys(orders).flatMap((policy) =>
      [true, false].map((boost) => simulate(seed, policy, boost, 40, true)),
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
    36,
    31,
    22,
    20,
    20,
    13,
    6,
    2,
    2,
    2,
    1,
    1,
    ...Array(21).fill(0),
  ]);
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
