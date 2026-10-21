import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_THIRTY_FIVE !== '1')(
  'compare stages 31–35 candidates',
  () => {
    const original = clone(config);
    const hp = [34, 25, 44, 23, 30],
      attack = [8, 7.5, 9.8, 7.2, 7];
    const candidates = [
      { name: 'standard', hp: 1, attack: 1, bossHp: 1600000, hit: 160, cleave: 250 },
      { name: 'tempered', hp: 0.9, attack: 0.9, bossHp: 1400000, hit: 140, cleave: 220 },
      { name: 'pressure', hp: 1.1, attack: 1.1, bossHp: 1800000, hit: 180, cleave: 270 },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (
          process.env.THIRTY_FIVE_CANDIDATE &&
          !process.env.THIRTY_FIVE_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        config.stages.slice(30, 35).forEach((s, i) => {
          s.hpMultiplier = Number((hp[i] * candidate.hp).toFixed(4));
          s.attackMultiplier = Number((attack[i] * candidate.attack).toFixed(4));
        });
        Object.assign(config.seventhBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 35, true),
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
          stages: config.stages.slice(30, 35).map(({ id }) => {
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
          `artifacts/thirty-five-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/thirty-five-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.seventhBoss, original.seventhBoss);
    }
  },
  60000,
);
