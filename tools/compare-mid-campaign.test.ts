import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config, enemyDefinitions, stages } from '../src/game/content';
import { simulate, orders, type BattleSample } from '../src/game/testing/campaign-simulation';
import baseline from '../docs/superpowers/specs/2026-10-16-prototype-balance-v8-snapshot.json';

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};
function summarize(samples: BattleSample[]) {
  const parents = samples.flatMap((b) =>
    b
      .enemies!.filter((e) => e.kind === 'summoner')
      .map((e) => {
        const children = b.enemies!.filter((c) => c.kind === 'summoned_wolf' && c.owner === e.id);
        return {
          lifetime: (e.died ?? b.time) - e.born,
          censored: e.died === undefined,
          children: children.length,
          casts: new Set(children.map((c) => c.born)).size,
          immediateDeaths: children.filter((c) => c.died === c.born).length,
        };
      }),
  );
  return {
    reached: samples.length,
    wins: samples.filter((b) => b.result === 'victory').length,
    seconds: mean(samples.map((b) => b.time / 1000)),
    hpPercent: mean(samples.map((b) => b.hpRatio * 100)),
    damageTaken: mean(samples.map((b) => b.damageTaken)),
    injuredBattles: samples.filter((b) => b.injured > 0).length,
    injuredUnits: samples.reduce((n, b) => n + b.injured, 0),
    money: mean(samples.map((b) => b.money)),
    income: mean(samples.map((b) => b.report!.units.reduce((n, u) => n + u.income, 0))),
    summoners: {
      count: parents.length,
      castParents: parents.filter((p) => p.casts > 0).length,
      casts: parents.reduce((n, p) => n + p.casts, 0),
      children: parents.reduce((n, p) => n + p.children, 0),
      immediateDeaths: parents.reduce((n, p) => n + p.immediateDeaths, 0),
      lifetimeMeanMs: mean(parents.map((p) => p.lifetime)),
      lifetimeMedianMs: median(parents.map((p) => p.lifetime)),
      deadLifetimeMeanMs: mean(parents.filter((p) => !p.censored).map((p) => p.lifetime)),
      censored: parents.filter((p) => p.censored).length,
    },
  };
}

test.skipIf(process.env.COMPARE_MID !== '1')(
  'compare mid-campaign candidates on identical legal routes',
  () => {
    const original = clone(config);
    const candidates = [
      { name: 'baseline', hp: 1, attack: 1, summonerHp: 320, delay: 20000 },
      { name: 'light', hp: 1.25, attack: 1.1, summonerHp: 320, delay: 20000 },
      { name: 'medium', hp: 1.5, attack: 1.2, summonerHp: 320, delay: 20000 },
      ...[3200, 4000, 4400, 4800, 6400, 12800].flatMap((summonerHp) =>
        [20000, 10000].map((delay) => ({
          name: `medium-summoner-${summonerHp}-${delay}`,
          hp: 1.5,
          attack: 1.2,
          summonerHp,
          delay,
        })),
      ),
    ];
    const summaries = [];
    mkdirSync('artifacts', { recursive: true });
    const skill: { firstSummonDelayMs?: number } = enemyDefinitions.summoner.skills;
    const originalDelay = skill.firstSummonDelayMs;
    try {
      for (const candidate of candidates) {
        for (let index = 5; index <= 8; index++) {
          stages[index].hpMultiplier = Number(
            (baseline.stages[index].hpMultiplier * candidate.hp).toFixed(4),
          );
          stages[index].attackMultiplier = Number(
            (baseline.stages[index].attackMultiplier * candidate.attack).toFixed(4),
          );
        }
        enemyDefinitions.summoner.hp = candidate.summonerHp;
        skill.firstSummonDelayMs = candidate.delay;
        const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
          Object.keys(orders).flatMap((policy) =>
            [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 10, true), boost })),
          ),
        );
        const summary = {
          ...candidate,
          baselineVersion: baseline.contentVersion,
          runs: runs.length,
          completed: runs.filter((r) => r.complete).length,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            completed: runs.filter((r) => r.policy === policy && r.complete).length,
          })),
          stages: Array.from({ length: 10 }, (_, i) => ({
            stage: i + 1,
            ...summarize(runs.flatMap((r) => r.results.filter((b) => b.stage === i + 1))),
          })),
        };
        summaries.push(summary);
        writeFileSync(
          `artifacts/mid-${candidate.name}-samples.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
        console.log(JSON.stringify(summary));
      }
      writeFileSync('artifacts/mid-candidates.json', JSON.stringify(summaries, null, 2));
    } finally {
      original.stages.forEach((stage, index) => Object.assign(stages[index], stage));
      enemyDefinitions.summoner.hp = original.enemies.find((e) => e.id === 'summoner')!.hp;
      if (originalDelay === undefined) delete skill.firstSummonDelayMs;
      else skill.firstSummonDelayMs = originalDelay;
    }
  },
  60000,
);
