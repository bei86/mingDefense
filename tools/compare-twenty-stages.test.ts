import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_TWENTY !== '1')(
  'compare stages 16–20 candidates',
  () => {
    const original = clone(config);
    const hp = [14, 10, 16, 10.5, 13],
      attack = [4.2, 3.4, 4.5, 3.6, 4];
    const candidates = [
      { name: 'standard', hp: 1, attack: 1, bossHp: 850000, hit: 150, cleave: 200 },
      { name: 'pressure', hp: 1.5, attack: 1.4, bossHp: 1100000, hit: 180, cleave: 230 },
      { name: 'intense', hp: 2, attack: 1.8, bossHp: 1400000, hit: 200, cleave: 260 },
      {
        name: 'balanced',
        hp: 1.3,
        attack: 1.2,
        bossHp: 950000,
        hit: 165,
        cleave: 210,
        stageHp: [1.3, 1.3, 1.5, 1.2, 1.25],
        stageAttack: [1.2, 1.2, 1.4, 1.2, 1.2],
      },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (process.env.TWENTY_CANDIDATE && process.env.TWENTY_CANDIDATE !== candidate.name)
          continue;
        config.stages.slice(15, 20).forEach((s, i) => {
          s.hpMultiplier = Number((hp[i] * (candidate.stageHp?.[i] ?? candidate.hp)).toFixed(4));
          s.attackMultiplier = Number(
            (attack[i] * (candidate.stageAttack?.[i] ?? candidate.attack)).toFixed(4),
          );
        });
        Object.assign(config.fourthBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 20, true),
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
          stages: config.stages.slice(15, 20).map(({ id }) => {
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
          `artifacts/twenty-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/twenty-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.fourthBoss, original.fourthBoss);
    }
  },
  60000,
);
