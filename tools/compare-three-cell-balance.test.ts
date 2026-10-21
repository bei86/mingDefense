import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';
import baseline from '../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

type Candidate = {
  name: string;
  stageHp: number;
  stageAttack: number;
  bossHp: number;
  bossDamage: number;
  rangedDamage?: number;
  boss10Hp?: number;
};

test.skipIf(process.env.COMPARE_THREE_CELL !== '1')(
  'compare three-cell mid-campaign candidates using identical legal purchases',
  () => {
    const original = clone(config);
    const candidates: Candidate[] = [
      { name: 'baseline', stageHp: 1, stageAttack: 1, bossHp: 1, bossDamage: 1 },
      { name: 'light', stageHp: 0.9, stageAttack: 0.95, bossHp: 0.9, bossDamage: 0.9 },
      { name: 'balanced', stageHp: 0.85, stageAttack: 0.9, bossHp: 0.85, bossDamage: 0.85 },
      { name: 'gentle', stageHp: 0.8, stageAttack: 0.85, bossHp: 0.8, bossDamage: 0.8 },
      ...[16, 14, 12].map((rangedDamage) => ({
        name: `ranged-${rangedDamage}`,
        stageHp: 1,
        stageAttack: 1,
        bossHp: 1,
        bossDamage: 1,
        rangedDamage,
      })),
      {
        name: 'combined-light',
        stageHp: 0.9,
        stageAttack: 0.95,
        bossHp: 0.85,
        bossDamage: 0.85,
        rangedDamage: 14,
      },
      {
        name: 'combined-mid',
        stageHp: 0.9,
        stageAttack: 0.95,
        bossHp: 0.75,
        bossDamage: 0.85,
        rangedDamage: 14,
      },
      {
        name: 'combined-soft',
        stageHp: 0.85,
        stageAttack: 0.9,
        bossHp: 0.7,
        bossDamage: 0.8,
        rangedDamage: 12,
      },
      {
        name: 'boss-focus',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.5,
        bossDamage: 0.8,
        rangedDamage: 12,
      },
      {
        name: 'combined-focus',
        stageHp: 0.85,
        stageAttack: 0.9,
        bossHp: 0.5,
        bossDamage: 0.8,
        rangedDamage: 12,
      },
      {
        name: 'combined-focus14',
        stageHp: 0.85,
        stageAttack: 0.9,
        bossHp: 0.5,
        bossDamage: 0.8,
        rangedDamage: 14,
      },
      {
        name: 'boss-60',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.6,
        bossDamage: 0.8,
        rangedDamage: 12,
      },
      {
        name: 'boss-hp-only',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.5,
        bossDamage: 1,
        rangedDamage: 12,
      },
      {
        name: 'boss-50-ranged14',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.5,
        bossDamage: 0.8,
        rangedDamage: 14,
      },
      { name: 'hp-55', stageHp: 1, stageAttack: 1, bossHp: 0.55, bossDamage: 1, rangedDamage: 12 },
      {
        name: 'hp-targeted',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.5,
        bossDamage: 1,
        rangedDamage: 12,
        boss10Hp: 0.85,
      },
      {
        name: 'hp-minimal',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.5,
        bossDamage: 1,
        rangedDamage: 12,
        boss10Hp: 1,
      },
      {
        name: 'hp-milder',
        stageHp: 1,
        stageAttack: 1,
        bossHp: 0.55,
        bossDamage: 1,
        rangedDamage: 12,
        boss10Hp: 1,
      },
    ];
    const comparisons = [];
    const bossKeys = ['secondBoss', 'thirdBoss', 'fourthBoss'] as const;
    mkdirSync('artifacts', { recursive: true });
    try {
      for (const candidate of candidates) {
        if (
          process.env.THREE_CELL_CANDIDATE &&
          !process.env.THREE_CELL_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        config.enemies.find((e) => e.id === 'ranged')!.hitDamage =
          candidate.rangedDamage ?? baseline.enemies.find((e) => e.id === 'ranged')!.hitDamage;
        for (const id of [8, 13, 14]) {
          config.stages[id - 1].hpMultiplier = Number(
            (baseline.stages[id - 1].hpMultiplier * candidate.stageHp).toFixed(4),
          );
          config.stages[id - 1].attackMultiplier = Number(
            (baseline.stages[id - 1].attackMultiplier * candidate.stageAttack).toFixed(4),
          );
        }
        for (const key of bossKeys) {
          const hpScale =
            key === 'secondBoss' ? (candidate.boss10Hp ?? candidate.bossHp) : candidate.bossHp;
          config[key].hp = Math.round(baseline[key].hp * hpScale);
          config[key].hitDamage = Math.round(baseline[key].hitDamage * candidate.bossDamage);
          config[key].cleaveHitDamage = Math.round(
            baseline[key].cleaveHitDamage * candidate.bossDamage,
          );
        }
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 20, true), boost })),
          ),
        );
        const summary = {
          ...candidate,
          spawnRow: config.waves.spawnRow,
          completed: runs.filter((r) => r.complete).length,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            completed: runs.filter((r) => r.policy === policy && r.complete).length,
          })),
          stages: config.stages.slice(0, 20).map(({ id }) => {
            const battles = runs.flatMap((r) => r.results.filter((b) => b.stage === id));
            return {
              stage: id,
              reached: battles.length,
              won: battles.filter((b) => b.result === 'victory').length,
              meanSeconds: battles.length
                ? battles.reduce((n, b) => n + b.time / 1000, 0) / battles.length
                : null,
              timeouts: battles.filter(
                (b) => b.result === 'defeat' && b.time >= config.runtime.stageLimitMs,
              ).length,
            };
          }),
        };
        comparisons.push(summary);
        console.log(
          JSON.stringify({
            ...summary,
            stages: summary.stages.filter((s) => [5, 8, 10, 13, 14, 15, 20].includes(s.stage)),
          }),
        );
        writeFileSync(
          `artifacts/three-cell-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync('artifacts/three-cell-candidates.json', JSON.stringify(comparisons, null, 2));
    } finally {
      config.stages.forEach((s, i) => Object.assign(s, original.stages[i]));
      for (const key of bossKeys) Object.assign(config[key], original[key]);
      config.enemies.forEach((e, i) => Object.assign(e, original.enemies[i]));
      expect(config).toEqual(original);
    }
  },
  240000,
);
