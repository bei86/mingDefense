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
  hp37?: number;
  attack37?: number;
  hp39?: number;
  attack39?: number;
  hp40?: number;
  ranged40?: number;
};

test.skipIf(process.env.COMPARE_STAGE40_CALIBRATION !== '1')(
  'diagnose stages 37/40 and compare local calibration on identical legal routes',
  async () => {
    const original = clone(config);
    const stage37 = config.stages[36];
    const stage39 = config.stages[38];
    const stage40 = config.stages[39] as Stage;
    const reset = () => {
      Object.assign(stage37, clone(historical.stages[36]));
      Object.assign(stage39, clone(historical.stages[38]));
      Object.assign(stage40, clone(historical.stages[39]));
      Object.assign(config.eighthBoss, historical.eighthBoss);
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
      writeFileSync('artifacts/stage40-baseline-72.json', JSON.stringify(baseline));
      const sources = baseline.filter((r) => r.checkpoints.length >= 37);
      expect(sources).toHaveLength(2);
      expect(sources.every((r) => validSave(r.checkpoints[36]))).toBe(true);
      stage37.attackMultiplier = 7.29;
      const unblocked = sources.map((r) => ({
        ...simulate(r.seed, r.policy, r.boost, 40, true),
        boost: r.boost,
      }));
      stage39.hpMultiplier = 20.25;
      const finalSources = sources.map((r) => ({
        ...simulate(r.seed, r.policy, r.boost, 40, true),
        boost: r.boost,
      }));
      expect(finalSources.every((r) => r.checkpoints.length === 40)).toBe(true);
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
            Object.assign(config.eighthBoss, { hitDamage: 1, cleaveHitDamage: 1 });
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
            config.eighthBoss.maxLivingSummons = 0;
          },
        },
      ];
      for (const diagnostic of diagnostics) {
        reset();
        diagnostic.apply();
        const groups = [
          { name: 'v21-stage37', stage: 37, routes: sources },
          { name: 'v21-stage40', stage: 40, routes: sources },
          { name: 'after37-attack90-stage39', stage: 39, routes: unblocked },
          { name: 'after37-attack90-after39-hp75-stage40', stage: 40, routes: finalSources },
        ];
        const runs = groups.flatMap(({ name, stage, routes }) =>
          routes
            .filter((r) => r.checkpoints.length >= stage)
            .map((r) => {
              const result = replay(r.checkpoints[stage - 1], r.policy, r.boost);
              if (diagnostic.name === 'baseline') {
                expect(result.time).toBe(r.results[stage - 1].time);
                expect(result.hp).toBe(r.results[stage - 1].hp);
                expect(result.report).toEqual(r.results[stage - 1].report);
              }
              return { group: name, ...result };
            }),
        );
        console.log(
          JSON.stringify({
            diagnostic: diagnostic.name,
            battles: runs.map(({ group, seed, result, time, hp, bossHp }) => ({
              group,
              seed,
              result,
              time,
              hp,
              bossHp,
            })),
          }),
        );
        writeFileSync(
          `artifacts/stage40-diagnostic-${diagnostic.name}.json`,
          JSON.stringify(runs, null, 2),
        );
      }
      const candidates: Candidate[] = [
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((hp39) => ({
          name: 'hp39-' + hp39,
          attack37: 0.9,
          hp39,
        })),
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((attack39) => ({
          name: 'attack39-' + attack39,
          attack37: 0.9,
          attack39,
        })),
        ...[7.3, 7.4, 7.5, 7.6].map((attack) => ({
          name: 'refine37-' + attack,
          attack37: attack / 8.1,
        })),
        ...[20.5, 20.75, 21, 21.25].map((hp) => ({
          name: 'refine39-' + hp,
          attack37: 0.9,
          hp39: hp / 27,
        })),
        ...[4, 3, 2, 1].flatMap((ranged40) =>
          [1, 0.9, 0.8, 0.7, 0.6, 0.5].map((hp40) => ({
            name: 'combined40-' + hp40 + '-' + ranged40,
            attack37: 0.9,
            hp39: 0.75,
            hp40,
            ranged40,
          })),
        ),
        ...[1900000, 1700000, 1500000].map((hp) => ({
          name: 'noguard40-' + hp,
          attack37: 7.3 / 8.1,
          hp39: 20.5 / 27,
          hp40: hp / 1900000,
          ranged40: 0,
        })),
        ...[1080000, 1060000, 1040000, 1020000, 1000000].map((hp) => ({
          name: 'final40-' + hp,
          attack37: 7.3 / 8.1,
          hp39: 20.5 / 27,
          hp40: hp / 1900000,
          ranged40: 1,
        })),
        { name: 'baseline' },
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((hp37) => ({ name: 'hp37-' + hp37, hp37 })),
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((attack37) => ({
          name: 'attack37-' + attack37,
          attack37,
        })),
      ];
      const requested = process.env.STAGE40_CANDIDATE?.split(',');
      const selected = requested
        ? candidates.filter((c) => requested.includes(c.name))
        : candidates;
      expect(selected.length).toBeGreaterThan(0);
      const summaries = [];
      for (const candidate of selected) {
        reset();
        stage37.hpMultiplier = Number(
          (historical.stages[36].hpMultiplier * (candidate.hp37 ?? 1)).toFixed(4),
        );
        stage37.attackMultiplier = Number(
          (historical.stages[36].attackMultiplier * (candidate.attack37 ?? 1)).toFixed(4),
        );
        stage39.hpMultiplier = Number(
          (historical.stages[38].hpMultiplier * (candidate.hp39 ?? 1)).toFixed(4),
        );
        stage39.attackMultiplier = Number(
          (historical.stages[38].attackMultiplier * (candidate.attack39 ?? 1)).toFixed(4),
        );
        config.eighthBoss.hp = Math.round(historical.eighthBoss.hp * (candidate.hp40 ?? 1));
        if (candidate.ranged40 !== undefined)
          stage40.waves.forEach((wave, i) => {
            wave.enemies.ranged = candidate.ranged40;
            wave.atMs = i * (4 + candidate.ranged40!) * 1000;
          });
        const runs = sources.map((source) => {
          const run = {
            ...simulate(source.seed, source.policy, source.boost, 40, true),
            boost: source.boost,
          };
          expect(run.results.slice(0, 36)).toEqual(source.results.slice(0, 36));
          expect(run.checkpoints.slice(0, 37)).toEqual(source.checkpoints.slice(0, 37));
          return run;
        });
        const summary = {
          name: candidate.name,
          hp37: stage37.hpMultiplier,
          attack37: stage37.attackMultiplier,
          hp39: stage39.hpMultiplier,
          attack39: stage39.attackMultiplier,
          hp40: config.eighthBoss.hp,
          ranged40: stage40.waves.map((w) => w.enemies.ranged),
          late: Array.from({ length: 4 }, (_, i) => i + 37).map((stage) => ({
            stage,
            won: runs.filter((r) => r.results[stage - 1]?.result === 'victory').length,
          })),
          battles: runs.map((r) => ({
            seed: r.seed,
            policy: r.policy,
            boost: r.boost,
            results: r.results
              .slice(36)
              .map(({ stage, result, time, hp, bossHp }) => ({ stage, result, time, hp, bossHp })),
          })),
        };
        summaries.push(summary);
        console.log(JSON.stringify(summary));
        const replays = runs
          .filter((r) => r.checkpoints.length >= 40)
          .map((r) => {
            const result = replay(r.checkpoints[39], r.policy, r.boost);
            expect(result.time).toBe(r.results[39].time);
            expect(result.report).toEqual(r.results[39].report);
            return result;
          });
        writeFileSync(
          `artifacts/stage40-calibration-${candidate.name}.json`,
          JSON.stringify({ summary, runs, replays }, null, 2),
        );
        await setImmediate();
      }
      writeFileSync(
        'artifacts/stage40-calibration-candidates.json',
        JSON.stringify(summaries, null, 2),
      );
    } finally {
      Object.assign(stage37, original.stages[36]);
      Object.assign(stage39, original.stages[38]);
      Object.assign(stage40, original.stages[39]);
      Object.assign(config.eighthBoss, original.eighthBoss);
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
      expect(config).toEqual(original);
    }
  },
  120000,
);
