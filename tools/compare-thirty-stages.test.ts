import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_THIRTY !== '1')(
  'compare stages 26–30 candidates',
  () => {
    const original = clone(config);
    const hp = [40, 18, 40, 19, 28],
      attack = [8.5, 6, 9, 6.5, 6.5];
    const candidates = [
      { name: 'standard', hp: 1, attack: 1, bossHp: 1300000, hit: 120, cleave: 210 },
      { name: 'pressure', hp: 1.25, attack: 1.2, bossHp: 1600000, hit: 150, cleave: 250 },
      { name: 'tempered', hp: 0.9, attack: 0.95, bossHp: 1200000, hit: 110, cleave: 200 },
      {
        name: 'balanced',
        hp: 1,
        attack: 1,
        bossHp: 1400000,
        hit: 135,
        cleave: 230,
        stageHp: [0.8, 1.2, 1.15, 1.1, 1],
        stageAttack: [0.9, 1.2, 1.15, 1.1, 1],
      },
      {
        name: 'steady',
        hp: 1,
        attack: 1,
        bossHp: 1400000,
        hit: 135,
        cleave: 230,
        stageHp: [0.8, 1.2, 1.05, 1.05, 1],
        stageAttack: [0.9, 1.2, 1.05, 1.05, 1],
      },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (
          process.env.THIRTY_CANDIDATE &&
          !process.env.THIRTY_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        config.stages.slice(25, 30).forEach((s, i) => {
          s.hpMultiplier = Number((hp[i] * (candidate.stageHp?.[i] ?? candidate.hp)).toFixed(4));
          s.attackMultiplier = Number(
            (attack[i] * (candidate.stageAttack?.[i] ?? candidate.attack)).toFixed(4),
          );
        });
        Object.assign(config.sixthBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 30, true),
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
          stages: config.stages.slice(25, 30).map(({ id }) => {
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
          `artifacts/thirty-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/thirty-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.sixthBoss, original.sixthBoss);
    }
  },
  60000,
);
