import { useLegacyApproach } from '../src/game/testing/legacy-approach';
import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

useLegacyApproach();

test.skipIf(process.env.UPDATE_FORTY_FIXTURE !== '1')(
  'export forty-stage samples and checkpoints',
  async () => {
    const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
      Object.keys(orders).flatMap((policy) =>
        [true, false].map((boost) => ({
          ...simulate(seed, policy, boost, 40, true),
          boost,
        })),
      ),
    );
    const summary = {
      contentVersion: config.contentVersion,
      ruleset: 'legacy-one-cell',
      spawnRow: config.waves.spawnRow,
      runs: runs.length,
      completed: runs.filter((r) => r.complete).length,
      policies: Object.keys(orders).map((policy) => ({
        policy,
        completed: runs.filter((r) => r.policy === policy && r.complete).length,
      })),
      stages: config.stages.map(({ id }) => {
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
    console.log(JSON.stringify(summary));
    mkdirSync('artifacts', { recursive: true });
    writeFileSync(
      'artifacts/forty-stages-samples.json',
      JSON.stringify({ summary, runs }, null, 2),
    );
    const viable = runs.find((r) => r.complete);
    if (!viable) throw new Error('No legal complete route');
    const style = await resolveConfig('src/game/fixtures/stage-6-checkpoint.json');
    for (const stage of [36, 40])
      writeFileSync(
        `src/game/fixtures/stage-${stage}-checkpoint.json`,
        await format(JSON.stringify(viable.checkpoints[stage - 1]), { ...style, parser: 'json' }),
      );
  },
  30000,
);
