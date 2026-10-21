import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_FORTY !== '1')(
  'compare stages 36–40 candidates',
  () => {
    const original = clone(config);
    const hp = [40, 29, 52, 27, 34],
      attack = [8.8, 8.1, 10.5, 7.8, 7.5];
    const candidates = [
      { name: 'standard', hp: 1, attack: 1, bossHp: 1900000, hit: 155, cleave: 280 },
      { name: 'tempered', hp: 0.9, attack: 0.9, bossHp: 1700000, hit: 140, cleave: 250 },
      { name: 'pressure', hp: 1.1, attack: 1.1, bossHp: 2100000, hit: 175, cleave: 310 },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (
          process.env.FORTY_CANDIDATE &&
          !process.env.FORTY_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        config.stages.slice(35, 40).forEach((s, i) => {
          s.hpMultiplier = Number((hp[i] * candidate.hp).toFixed(4));
          s.attackMultiplier = Number((attack[i] * candidate.attack).toFixed(4));
        });
        Object.assign(config.eighthBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 40, true),
              boost,
            })),
          ),
        );
        const summary = {
          ...candidate,
          completed: runs.filter((r) => r.complete).length,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            completed: runs.filter((r) => r.policy === policy && r.complete).length,
          })),
          stages: config.stages.slice(35, 40).map(({ id }) => {
            const battles = runs.flatMap((r) => r.results.filter((b) => b.stage === id));
            return {
              stage: id,
              reached: battles.length,
              won: battles.filter((b) => b.result === 'victory').length,
              meanSeconds: battles.reduce((n, b) => n + b.time / 1000, 0) / battles.length,
              meanHpPercent: battles.reduce((n, b) => n + b.hpRatio * 100, 0) / battles.length,
            };
          }),
        };
        comparisons.push(summary);
        console.log(JSON.stringify(summary));
        writeFileSync(
          `artifacts/forty-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/forty-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.eighthBoss, original.eighthBoss);
    }
  },
  60000,
);
