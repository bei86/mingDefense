import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.COMPARE_LATE !== '1')(
  'compare new-stage candidates',
  () => {
    const original = clone(config);
    // Base values are kept here so re-running after final tuning remains reproducible.
    const baseHp = [4, 4.4, 4.8, 5.2, 5.6];
    const baseAttack = [1.8, 1.9, 2, 2.1, 2.2];
    const candidates = [
      { name: 'gentle', hp: 1, attack: 1, bossHp: 400000, hit: 110, cleave: 145 },
      { name: 'moderate', hp: 2, attack: 1.5, bossHp: 650000, hit: 135, cleave: 180 },
      { name: 'strong', hp: 3, attack: 2, bossHp: 900000, hit: 160, cleave: 210 },
      { name: 'severe', hp: 4, attack: 2.5, bossHp: 1200000, hit: 185, cleave: 240 },
      {
        name: 'progressive',
        hp: 2,
        attack: 1.5,
        bossHp: 650000,
        hit: 135,
        cleave: 180,
        stageHp: [3, 3, 1.8, 1.7, 2],
        stageAttack: [2, 2, 1.5, 1.4, 1.5],
      },
    ];
    const comparisons = [];
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (process.env.LATE_CANDIDATE && candidate.name !== process.env.LATE_CANDIDATE) continue;
        config.stages.slice(10, 15).forEach((s, i) => {
          s.hpMultiplier = Number(
            (baseHp[i] * (candidate.stageHp?.[i] ?? candidate.hp)).toFixed(4),
          );
          s.attackMultiplier = Number(
            (baseAttack[i] * (candidate.stageAttack?.[i] ?? candidate.attack)).toFixed(4),
          );
        });
        Object.assign(config.thirdBoss, {
          hp: candidate.bossHp,
          hitDamage: candidate.hit,
          cleaveHitDamage: candidate.cleave,
        });
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({
              ...simulate(seed, policy, boost, 15, true),
              boost,
            })),
          ),
        );
        const summary = {
          ...candidate,
          complete: runs.filter((r) => r.complete).length,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            complete: runs.filter((r) => r.policy === policy && r.complete).length,
          })),
          stages: config.stages.slice(10, 15).map(({ id }) => {
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
          `artifacts/late-candidate-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/late-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      Object.assign(config.thirdBoss, original.thirdBoss);
    }
  },
  60000,
);
