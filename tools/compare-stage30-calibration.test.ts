import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { clone, config, type Stage } from '../src/game/content';
import { Session, type SessionSave } from '../src/game/session';
import { validSave } from '../src/game/persistence';
import { observeEnemies } from '../src/game/combat-diagnostics';
import { simulate, orders } from '../src/game/testing/campaign-simulation';
import type { BuffId } from '../src/game/model';
import historical from '../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

function replay(save: SessionSave, policy: string, boost: boolean) {
  const session = Session.restore(save);
  expect(session.start()).toBeNull();
  const battle = session.battle!;
  const lifetimes = observeEnemies(battle);
  const samples = [];
  const priority: BuffId[] =
    policy === 'economy'
      ? [
          'reward',
          'attack',
          'attack_speed',
          'bear_attack',
          'monkey_vulnerability',
          'health',
          'slow',
          'range',
        ]
      : [
          'attack',
          'attack_speed',
          'boar_attack',
          'bear_attack',
          'monkey_vulnerability',
          'eagle_residue',
          'health',
          'slow',
          'range',
          'reward',
        ];
  for (let tick = 0; tick < 10000 && session.phase === 'combat'; tick++) {
    if (session.hasChoices) {
      const score = (id: BuffId) => (priority.includes(id) ? priority.indexOf(id) : 99);
      session.chooseBuff([...battle.choices].sort((a, b) => score(a) - score(b))[0]);
      continue;
    }
    session.held = boost && battle.energy >= 1;
    session.tick();
    if (battle.time % 5000 === 0 || session.phase !== 'combat') {
      const living = battle.enemies.filter((e) => e.hp > 0);
      samples.push({
        time: battle.time,
        allyHp: session.totalHealth(),
        bossHp: living.find((e) => e.kind === 'boss')?.hp ?? 0,
        living: Object.fromEntries(
          [...new Set(living.map((e) => e.kind))].map((kind) => [
            kind,
            living.filter((e) => e.kind === kind).length,
          ]),
        ),
      });
    }
  }
  expect(['victory', 'defeat']).toContain(session.phase);
  return {
    seed: save.seed,
    policy,
    boost,
    stage: save.preparation.stageId,
    result: session.phase,
    time: battle.time,
    hp: session.totalHealth(),
    bossHp: battle.enemies.find((e) => e.kind === 'boss')?.hp ?? 0,
    report: clone(battle.report),
    samples,
    lifetimes: clone(lifetimes),
  };
}

type Candidate = {
  name: string;
  hp28?: number;
  attack28?: number;
  hp29?: number;
  attack29?: number;
  hp30?: number;
  ranged30?: number;
};

test.skipIf(process.env.COMPARE_STAGE30_CALIBRATION !== '1')(
  'diagnose stages 28/30 and compare local calibration on identical legal routes',
  async () => {
    const original = clone(config);
    const stage28 = config.stages[27];
    const stage29 = config.stages[28];
    const stage30 = config.stages[29] as Stage;
    const reset = () => {
      Object.assign(stage28, clone(historical.stages[27]));
      Object.assign(stage29, clone(historical.stages[28]));
      Object.assign(stage30, clone(historical.stages[29]));
      Object.assign(config.sixthBoss, historical.sixthBoss);
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
    };
    mkdirSync('artifacts', { recursive: true });
    try {
      reset();
      const baseline = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
        Object.keys(orders).flatMap((policy) =>
          [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 40, true), boost })),
        ),
      );
      writeFileSync('artifacts/stage30-baseline-72.json', JSON.stringify(baseline));
      const sources = baseline.filter((r) => r.checkpoints.length >= 28);
      expect(sources).toHaveLength(2);
      expect(sources.every((r) => validSave(r.checkpoints[27]))).toBe(true);
      stage28.hpMultiplier = 37.8;
      const sources29 = sources.map((r) => ({
        ...simulate(r.seed, r.policy, r.boost, 40, true),
        boost: r.boost,
      }));
      expect(sources29.every((r) => r.checkpoints.length >= 29)).toBe(true);
      stage29.attackMultiplier = 6.5;
      const sources30 = sources.map((r) => ({
        ...simulate(r.seed, r.policy, r.boost, 40, true),
        boost: r.boost,
      }));
      expect(sources30.every((r) => r.checkpoints.length >= 30)).toBe(true);
      const diagnostics = [
        { name: 'baseline', apply: () => {} },
        {
          name: 'ranged-damage',
          apply: () => {
            config.enemies.find((e) => e.id === 'ranged')!.hitDamage = 1;
          },
        },
        {
          name: 'fragment-damage',
          apply: () => {
            config.enemies.find((e) => e.id === 'split_fragment')!.hitDamage = 1;
          },
        },
        {
          name: 'boss-damage',
          apply: () => {
            Object.assign(config.sixthBoss, { hitDamage: 1, cleaveHitDamage: 1 });
          },
        },
        {
          name: 'summon-damage',
          apply: () => {
            config.enemies.find((e) => e.id === 'summoned_wolf')!.hitDamage = 1;
          },
        },
        {
          name: 'no-summons',
          apply: () => {
            config.sixthBoss.maxLivingSummons = 0;
          },
        },
      ];
      for (const diagnostic of diagnostics) {
        reset();
        diagnostic.apply();
        const diagnosticSources = { 28: sources, 29: sources29, 30: sources30 };
        const runs = ([28, 29, 30] as const).flatMap((id) =>
          diagnosticSources[id]
            .filter((r) => r.checkpoints.length >= id)
            .map((r) => {
              const run = replay(r.checkpoints[id - 1], r.policy, r.boost);
              if (diagnostic.name === 'baseline') {
                expect(run.time).toBe(r.results[id - 1].time);
                expect(run.result).toBe(r.results[id - 1].result);
                expect(run.hp).toBe(r.results[id - 1].hp);
                expect(run.report).toEqual(r.results[id - 1].report);
              }
              return run;
            }),
        );
        console.log(
          JSON.stringify({
            diagnostic: diagnostic.name,
            battles: runs.map(({ stage, seed, result, time, hp, bossHp }) => ({
              stage,
              seed,
              result,
              time,
              hp,
              bossHp,
            })),
          }),
        );
        writeFileSync(
          `artifacts/stage30-diagnostic-${diagnostic.name}.json`,
          JSON.stringify(runs, null, 2),
        );
      }
      const candidates: Candidate[] = [
        { name: 'baseline' },
        ...[0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].map((hp28) => ({
          name: `hp28-${hp28}`,
          hp28,
        })),
        ...[0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].map((attack28) => ({
          name: `attack28-${attack28}`,
          attack28,
        })),
        ...[0.9, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].map((hp30) => ({ name: `hp30-${hp30}`, hp30 })),
        ...[0.9, 0.8, 0.75, 0.7, 0.65].map((hp30) => ({
          name: `escort30-${hp30}`,
          hp30,
          ranged30: 2,
        })),
        ...[0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].map((hp29) => ({
          name: `hp29-${hp29}`,
          hp28: 0.9,
          hp29,
        })),
        ...[0.95, 0.9, 0.85, 0.8, 0.75, 0.7].map((attack29) => ({
          name: `attack29-${attack29}`,
          hp28: 0.9,
          attack29,
        })),
        ...[0.75, 0.7, 0.6, 0.5, 0.4, 0.3].map((hp30) => ({
          name: `combined30-${hp30}-4`,
          hp28: 0.9,
          attack29: 6.5 / 6.825,
          hp30,
        })),
        ...[1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5].map((hp30) => ({
          name: `combined30-${hp30}-2`,
          hp28: 0.9,
          attack29: 6.5 / 6.825,
          hp30,
          ranged30: 2,
        })),
        ...[0.8, 0.7, 0.6, 0.5].map((hp30) => ({
          name: `combined30-${hp30}-3`,
          hp28: 0.9,
          attack29: 6.5 / 6.825,
          hp30,
          ranged30: 3,
        })),
        ...[1, 0.9, 0.8, 0.7].map((hp30) => ({
          name: `combined30-${hp30}-1`,
          hp28: 0.9,
          attack29: 6.5 / 6.825,
          hp30,
          ranged30: 1,
        })),
        ...[1100000, 1080000, 1050000, 1000000].map((hp) => ({
          name: `rounded30-${hp}`,
          hp28: 0.9,
          attack29: 6.5 / 6.825,
          hp30: hp / 1400000,
          ranged30: 1,
        })),
        ...[38, 38.5, 39].map((hp) => ({
          name: `rounded28-${hp}`,
          hp28: hp / 42,
          attack29: 6.5 / 6.825,
          hp30: 0.75,
          ranged30: 1,
        })),
        { name: 'rounded29-6.55', hp28: 0.9, attack29: 6.55 / 6.825, hp30: 0.75, ranged30: 1 },
      ];
      if (process.env.STAGE30_HP28 && process.env.STAGE30_HP30)
        candidates.push({
          name: 'selected',
          hp28: Number(process.env.STAGE30_HP28),
          hp30: Number(process.env.STAGE30_HP30),
          attack28: Number(process.env.STAGE30_ATTACK28 ?? 1),
          ranged30: Number(process.env.STAGE30_RANGED ?? 4),
          hp29: Number(process.env.STAGE30_HP29 ?? 1),
          attack29: Number(process.env.STAGE30_ATTACK29 ?? 1),
        });
      const summaries = [];
      for (const candidate of candidates) {
        if (
          process.env.STAGE30_CANDIDATE &&
          !process.env.STAGE30_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        reset();
        stage28.hpMultiplier = Number(
          (historical.stages[27].hpMultiplier * (candidate.hp28 ?? 1)).toFixed(4),
        );
        stage28.attackMultiplier = Number(
          (historical.stages[27].attackMultiplier * (candidate.attack28 ?? 1)).toFixed(4),
        );
        stage29.hpMultiplier = Number(
          (historical.stages[28].hpMultiplier * (candidate.hp29 ?? 1)).toFixed(4),
        );
        stage29.attackMultiplier = Number(
          (historical.stages[28].attackMultiplier * (candidate.attack29 ?? 1)).toFixed(4),
        );
        config.sixthBoss.hp = Math.round(historical.sixthBoss.hp * (candidate.hp30 ?? 1));
        if (candidate.ranged30 !== undefined)
          stage30.waves.forEach((wave, i) => {
            wave.enemies.ranged = candidate.ranged30;
            wave.atMs = i * (4 + candidate.ranged30!) * 1000;
          });
        const runs = sources.map((source) => {
          const run = {
            ...simulate(source.seed, source.policy, source.boost, 40, true),
            boost: source.boost,
          };
          expect(run.results.slice(0, 27)).toEqual(source.results.slice(0, 27));
          expect(run.checkpoints.slice(0, 28)).toEqual(source.checkpoints.slice(0, 28));
          return run;
        });
        const summary = {
          name: candidate.name,
          hp28: stage28.hpMultiplier,
          attack28: stage28.attackMultiplier,
          hp29: stage29.hpMultiplier,
          attack29: stage29.attackMultiplier,
          hp30: config.sixthBoss.hp,
          ranged30: stage30.waves.map((w) => w.enemies.ranged),
          late: [28, 29, 30, 31, 32, 33, 34, 35, 40].map((stage) => ({
            stage,
            won: runs.filter((r) => r.results[stage - 1]?.result === 'victory').length,
          })),
          battles: runs.map((r) => ({
            seed: r.seed,
            policy: r.policy,
            boost: r.boost,
            results: r.results
              .slice(27)
              .map(({ stage, result, time, hp, bossHp }) => ({ stage, result, time, hp, bossHp })),
          })),
        };
        console.log(JSON.stringify(summary));
        summaries.push(summary);
        const replays = runs
          .filter((r) => r.checkpoints.length >= 30)
          .map((r) => {
            const battle = replay(r.checkpoints[29], r.policy, r.boost);
            expect(battle.time).toBe(r.results[29].time);
            expect(battle.report).toEqual(r.results[29].report);
            return battle;
          });
        writeFileSync(
          `artifacts/stage30-calibration-${candidate.name}.json`,
          JSON.stringify({ summary, runs, replays }, null, 2),
        );
        // Long opt-in sweeps must allow Vitest's worker messages to be processed.
        await setImmediate();
      }
      writeFileSync(
        'artifacts/stage30-calibration-candidates.json',
        JSON.stringify(summaries, null, 2),
      );
    } finally {
      Object.assign(stage28, original.stages[27]);
      Object.assign(stage29, original.stages[28]);
      Object.assign(stage30, original.stages[29]);
      Object.assign(config.sixthBoss, original.sixthBoss);
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
      expect(config).toEqual(original);
    }
  },
  120000,
);
