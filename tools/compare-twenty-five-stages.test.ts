import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_TWENTY_FIVE !== '1')(
  'compare stages 21–25 candidates',
  () => {
    const original = clone(config);
    const hp = [30, 18, 36, 18, 24],
      attack = [7, 5.5, 8, 6, 6];
    const candidates = [
      { name: 'standard', hp: 1, attack: 1, bossHp: 1350000, hit: 190, cleave: 250 },
      { name: 'pressure', hp: 1.3, attack: 1.25, bossHp: 1650000, hit: 220, cleave: 290 },
      { name: 'intense', hp: 1.6, attack: 1.5, bossHp: 1950000, hit: 250, cleave: 330 },
      {
        name: 'balanced',
        hp: 1,
        attack: 1,
        bossHp: 1200000,
        hit: 180,
        cleave: 240,
        stageHp: [1.1, 0.8, 0.95, 0.85, 0.9],
        stageAttack: [1.1, 0.9, 1, 0.95, 1],
      },
      {
        name: 'tempered',
        hp: 1,
        attack: 1,
        bossHp: 1100000,
        hit: 175,
        cleave: 230,
        stageHp: [1.1, 0.75, 0.9, 0.8, 0.85],
        stageAttack: [1.1, 0.85, 0.95, 0.9, 0.95],
      },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (
          process.env.TWENTY_FIVE_CANDIDATE &&
          !process.env.TWENTY_FIVE_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        config.stages.slice(20, 25).forEach((s, i) => {
          s.hpMultiplier = Number((hp[i] * (candidate.stageHp?.[i] ?? candidate.hp)).toFixed(4));
          s.attackMultiplier = Number(
            (attack[i] * (candidate.stageAttack?.[i] ?? candidate.attack)).toFixed(4),
          );
        });
        Object.assign(config.fifthBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 25, true),
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
          stages: config.stages.slice(20, 25).map(({ id }) => {
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
          `artifacts/twenty-five-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/twenty-five-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.fifthBoss, original.fifthBoss);
    }
  },
  60000,
);
