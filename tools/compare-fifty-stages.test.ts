import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { orders, simulate } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_FIFTY !== '1')(
  'compare only the new five stages on 72 identical legal routes',
  () => {
    const stages = clone(config.stages.slice(45));
    const boss = clone(config.tenthBoss);
    const results = [];
    try {
      for (const [name, scale] of [
        ['tempered', 0.85],
        ['standard', 1],
        ['pressure', 1.2],
      ] as const) {
        stages.forEach((stage, i) =>
          Object.assign(config.stages[i + 45], clone(stage), {
            hpMultiplier: stage.hpMultiplier * scale,
            attackMultiplier: stage.attackMultiplier * scale,
          }),
        );
        Object.assign(config.tenthBoss, boss, {
          hp: Math.round(boss.hp * scale),
          hitDamage: Math.round(boss.hitDamage * scale),
          cleaveHitDamage: Math.round(boss.cleaveHitDamage * scale),
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 50),
              boost,
            })),
          ),
        );
        const summary = {
          name,
          scale,
          wins: Array.from(
            { length: 50 },
            (_, i) => runs.filter((r) => r.results[i]?.result === 'victory').length,
          ),
          policies: Object.keys(orders).map((policy) => ({
            policy,
            complete: runs.filter((r) => r.policy === policy && r.complete).length,
          })),
          lateRoutes: runs
            .filter((r) => r.results.length >= 46)
            .map((r) => ({
              seed: r.seed,
              policy: r.policy,
              boost: r.boost,
              complete: r.complete,
              results: r.results.slice(45),
            })),
        };
        expect(runs).toHaveLength(72);
        results.push(summary);
        console.log(
          JSON.stringify({ name, scale, wins: summary.wins.slice(45), policies: summary.policies }),
        );
      }
      mkdirSync('artifacts', { recursive: true });
      writeFileSync('artifacts/fifty-candidates.json', JSON.stringify(results, null, 2));
    } finally {
      stages.forEach((stage, i) => Object.assign(config.stages[i + 45], stage));
      Object.assign(config.tenthBoss, boss);
    }
  },
  120000,
);
