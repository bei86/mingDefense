import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clone, config } from '../src/game/content';
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
      samples.push({
        time: battle.time,
        allyHp: session.totalHealth(),
        bossHp: battle.enemies.find((e) => e.kind === 'boss')?.hp ?? 0,
        living: Object.fromEntries(
          ['boss', 'wolf', 'ranged', 'summoned_wolf'].map((kind) => [
            kind,
            battle.enemies.filter((e) => e.kind === kind && e.hp > 0).length,
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
    result: session.phase,
    time: battle.time,
    hp: session.totalHealth(),
    bossHp: battle.enemies.find((e) => e.kind === 'boss')?.hp ?? 0,
    report: clone(battle.report),
    samples,
    lifetimes: clone(lifetimes),
  };
}

test.skipIf(process.env.COMPARE_STAGE25_CALIBRATION !== '1')(
  'diagnose stage 25 and compare isolated candidates from identical legal checkpoints',
  () => {
    const original = clone(config);
    const stage = config.stages[24];
    const reset = () => {
      Object.assign(config.fifthBoss, historical.fifthBoss);
      Object.assign(stage, clone(historical.stages[24]));
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
    };
    mkdirSync('artifacts', { recursive: true });
    try {
      reset();
      const routes = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
        Object.keys(orders).flatMap((policy) =>
          [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 25, true), boost })),
        ),
      );
      const sources = routes.filter((r) => r.checkpoints.length === 25);
      expect(sources).toHaveLength(4);
      expect(sources.every((r) => validSave(r.checkpoints[24]))).toBe(true);
      const cases = [
        { name: 'baseline', apply: () => {} },
        {
          name: 'escort-800k',
          apply: () => {
            config.fifthBoss.hp = 800000;
            stage.waves.forEach((wave, i) => {
              wave.enemies.ranged = 2;
              wave.atMs = i * 6000;
            });
          },
        },
        {
          name: 'diagnostic-boss-damage',
          apply: () => Object.assign(config.fifthBoss, { hitDamage: 1, cleaveHitDamage: 1 }),
        },
        {
          name: 'diagnostic-ranged-damage',
          apply: () => {
            config.enemies.find((e) => e.id === 'ranged')!.hitDamage = 1;
          },
        },
        {
          name: 'diagnostic-summon-damage',
          apply: () => {
            config.enemies.find((e) => e.id === 'summoned_wolf')!.hitDamage = 1;
          },
        },
        {
          name: 'diagnostic-no-summons',
          apply: () => {
            config.fifthBoss.maxLivingSummons = 0;
          },
        },
        ...[0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5].map((scale) => ({
          name: `hp-${Math.round(scale * 100)}`,
          apply: () => {
            config.fifthBoss.hp = Math.round(historical.fifthBoss.hp * scale);
          },
        })),
        ...[0.9, 0.8, 0.7, 0.6, 0.5].map((scale) => ({
          name: `attack-${Math.round(scale * 100)}`,
          apply: () => {
            stage.attackMultiplier = Number(
              (historical.stages[24].attackMultiplier * scale).toFixed(4),
            );
          },
        })),
        ...[
          [0.85, 0.85],
          [0.75, 0.85],
          [0.75, 0.75],
          [0.65, 0.85],
          [0.65, 0.75],
          [0.65, 0.7],
          [0.65, 0.65],
          [0.75, 0.6],
        ].map(([hp, attack]) => ({
          name: `combined-${hp}-${attack}`,
          apply: () => {
            config.fifthBoss.hp = Math.round(historical.fifthBoss.hp * hp);
            stage.attackMultiplier = Number(
              (historical.stages[24].attackMultiplier * attack).toFixed(4),
            );
          },
        })),
        ...[
          [1, 3],
          [1, 2],
          [0.85, 3],
          [0.85, 2],
          [0.75, 3],
          [0.75, 2],
          [0.7, 2],
          [0.725, 2],
          [0.65, 3],
          [0.65, 2],
        ].map(([hp, ranged]) => ({
          name: `escort-${hp}-${ranged}`,
          apply: () => {
            config.fifthBoss.hp = Math.round(historical.fifthBoss.hp * hp);
            stage.waves.forEach((wave, i) => {
              wave.enemies.ranged = ranged;
              wave.atMs = i * (4 + ranged) * 1000;
            });
          },
        })),
      ];
      const summaries = [];
      for (const candidate of cases) {
        if (
          process.env.STAGE25_CANDIDATE &&
          !process.env.STAGE25_CANDIDATE.split(',').includes(candidate.name)
        )
          continue;
        reset();
        candidate.apply();
        const runs = sources.map((r) => replay(r.checkpoints[24], r.policy, r.boost));
        if (candidate.name === 'baseline')
          runs.forEach((run, i) => {
            expect(run.time).toBe(sources[i].results[24].time);
            expect(run.bossHp).toBe(sources[i].results[24].bossHp);
          });
        const summary = {
          name: candidate.name,
          totalRoutes: 72,
          reached25: sources.length,
          hp: config.fifthBoss.hp,
          attackMultiplier: stage.attackMultiplier,
          rangedPerWave: stage.waves.map((w) => w.enemies.ranged),
          won25: runs.filter((r) => r.result === 'victory').length,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            won: runs.filter((r) => r.policy === policy && r.result === 'victory').length,
          })),
          battles: runs.map(({ seed, policy, boost, result, time, bossHp }) => ({
            seed,
            policy,
            boost,
            result,
            time,
            bossHp,
          })),
        };
        summaries.push(summary);
        console.log(JSON.stringify(summary));
        writeFileSync(
          `artifacts/stage25-calibration-${candidate.name}.json`,
          JSON.stringify({ summary, runs }, null, 2),
        );
      }
      writeFileSync(
        'artifacts/stage25-calibration-candidates.json',
        JSON.stringify(summaries, null, 2),
      );
    } finally {
      Object.assign(config.fifthBoss, original.fifthBoss);
      Object.assign(stage, original.stages[24]);
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
      expect(config).toEqual(original);
    }
  },
  60000,
);
