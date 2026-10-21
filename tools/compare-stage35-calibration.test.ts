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
  hp33?: number;
  attack33?: number;
  hp35?: number;
  ranged35?: number;
};

test.skipIf(process.env.COMPARE_STAGE35_CALIBRATION !== '1')(
  'diagnose stages 33/35 and compare local calibration on identical legal routes',
  async () => {
    const original = clone(config);
    const stage33 = config.stages[32];
    const stage35 = config.stages[34] as Stage;
    const reset = () => {
      Object.assign(stage33, clone(historical.stages[32]));
      Object.assign(stage35, clone(historical.stages[34]));
      Object.assign(config.seventhBoss, historical.seventhBoss);
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
      writeFileSync('artifacts/stage35-baseline-72.json', JSON.stringify(baseline));
      const sources = baseline.filter((r) => r.checkpoints.length >= 33);
      expect(sources).toHaveLength(2);
      expect(sources.every((r) => validSave(r.checkpoints[32]))).toBe(true);
      stage33.hpMultiplier = 39.6;
      const unblocked = sources.map((r) => ({
        ...simulate(r.seed, r.policy, r.boost, 40, true),
        boost: r.boost,
      }));
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
            Object.assign(config.seventhBoss, { hitDamage: 1, cleaveHitDamage: 1 });
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
            config.seventhBoss.maxLivingSummons = 0;
          },
        },
      ];
      for (const diagnostic of diagnostics) {
        reset();
        diagnostic.apply();
        const groups = [
          { name: 'v20-stage33', stage: 33, routes: sources },
          { name: 'v20-stage35', stage: 35, routes: sources },
          { name: 'after33-hp90-stage35', stage: 35, routes: unblocked },
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
          `artifacts/stage35-diagnostic-${diagnostic.name}.json`,
          JSON.stringify(runs, null, 2),
        );
      }
      const candidates: Candidate[] = [
        ...[1560000, 1520000, 1500000, 1480000].map((hp) => ({
          name: `refine35-${hp}`,
          hp33: 0.9,
          hp35: hp / 1600000,
          ranged35: 1,
        })),
        { name: 'baseline' },
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((hp33) => ({ name: `hp33-${hp33}`, hp33 })),
        ...[0.98, 0.95, 0.9, 0.85, 0.8, 0.75].map((attack33) => ({
          name: `attack33-${attack33}`,
          attack33,
        })),
        ...[4, 3, 2, 1].flatMap((ranged35) =>
          [1, 0.9, 0.8, 0.75, 0.7, 0.65, 0.6].map((hp35) => ({
            name: `combined35-${hp35}-${ranged35}`,
            hp33: 0.9,
            hp35,
            ranged35,
          })),
        ),
      ];
      const requested = process.env.STAGE35_CANDIDATE?.split(',');
      const selected = requested
        ? candidates.filter((c) => requested.includes(c.name))
        : candidates;
      expect(selected.length).toBeGreaterThan(0);
      const summaries = [];
      for (const candidate of selected) {
        reset();
        stage33.hpMultiplier = Number(
          (historical.stages[32].hpMultiplier * (candidate.hp33 ?? 1)).toFixed(4),
        );
        stage33.attackMultiplier = Number(
          (historical.stages[32].attackMultiplier * (candidate.attack33 ?? 1)).toFixed(4),
        );
        config.seventhBoss.hp = Math.round(historical.seventhBoss.hp * (candidate.hp35 ?? 1));
        if (candidate.ranged35 !== undefined)
          stage35.waves.forEach((wave, i) => {
            wave.enemies.ranged = candidate.ranged35;
            wave.atMs = i * (4 + candidate.ranged35!) * 1000;
          });
        const runs = sources.map((source) => {
          const run = {
            ...simulate(source.seed, source.policy, source.boost, 40, true),
            boost: source.boost,
          };
          expect(run.results.slice(0, 32)).toEqual(source.results.slice(0, 32));
          expect(run.checkpoints.slice(0, 33)).toEqual(source.checkpoints.slice(0, 33));
          return run;
        });
        const summary = {
          name: candidate.name,
          hp33: stage33.hpMultiplier,
          attack33: stage33.attackMultiplier,
          hp35: config.seventhBoss.hp,
          ranged35: stage35.waves.map((w) => w.enemies.ranged),
          late: Array.from({ length: 8 }, (_, i) => i + 33).map((stage) => ({
            stage,
            won: runs.filter((r) => r.results[stage - 1]?.result === 'victory').length,
          })),
          battles: runs.map((r) => ({
            seed: r.seed,
            policy: r.policy,
            boost: r.boost,
            results: r.results
              .slice(32)
              .map(({ stage, result, time, hp, bossHp }) => ({ stage, result, time, hp, bossHp })),
          })),
        };
        summaries.push(summary);
        console.log(JSON.stringify(summary));
        const replays = runs
          .filter((r) => r.checkpoints.length >= 35)
          .map((r) => {
            const result = replay(r.checkpoints[34], r.policy, r.boost);
            expect(result.time).toBe(r.results[34].time);
            expect(result.report).toEqual(r.results[34].report);
            return result;
          });
        writeFileSync(
          `artifacts/stage35-calibration-${candidate.name}.json`,
          JSON.stringify({ summary, runs, replays }, null, 2),
        );
        await setImmediate();
      }
      writeFileSync(
        'artifacts/stage35-calibration-candidates.json',
        JSON.stringify(summaries, null, 2),
      );
    } finally {
      Object.assign(stage33, original.stages[32]);
      Object.assign(stage35, original.stages[34]);
      Object.assign(config.seventhBoss, original.seventhBoss);
      config.enemies.forEach((enemy, i) => Object.assign(enemy, original.enemies[i]));
      expect(config).toEqual(original);
    }
  },
  120000,
);
