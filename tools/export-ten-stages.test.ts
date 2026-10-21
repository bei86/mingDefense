import { useLegacyApproach } from '../src/game/testing/legacy-approach';
import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';
useLegacyApproach();

test.skipIf(process.env.UPDATE_TEN_FIXTURE !== '1')(
  'export ten-stage samples and checkpoints',
  async () => {
    const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
      Object.keys(orders).flatMap((policy) =>
        [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 10, true), boost })),
      ),
    );
    const summary = {
      contentVersion: config.contentVersion,
      ruleset: 'legacy-one-cell',
      spawnRow: config.waves.spawnRow,
      runs: runs.length,
      reachedSix: runs.filter((r) => r.results.length >= 6).length,
      reachedTen: runs.filter((r) => r.results.length === 10).length,
      completed: runs.filter((r) => r.complete).length,
    };
    console.log(JSON.stringify(summary));
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/ten-stages-samples.json', JSON.stringify({ summary, runs }, null, 2));
    const viable = runs.find((r) => r.complete);
    if (!viable) throw new Error('No legal complete route');
    const style = await resolveConfig('src/game/fixtures/stage-6-checkpoint.json');
    for (const stage of [6, 10])
      writeFileSync(
        `src/game/fixtures/stage-${stage}-checkpoint.json`,
        await format(JSON.stringify(viable.checkpoints[stage - 1]), { ...style, parser: 'json' }),
      );
    const summonRoute = runs.find(
      (r) =>
        r.complete && !r.boost && r.results[7].enemies!.some((e) => e.kind === 'summoned_wolf'),
    );
    if (!summonRoute) throw new Error('No legal complete route showing ordinary summons');
    writeFileSync(
      'src/game/fixtures/stage-8-checkpoint.json',
      await format(JSON.stringify(summonRoute.checkpoints[7]), { ...style, parser: 'json' }),
    );
    console.log(
      JSON.stringify({
        summonRoute: {
          seed: summonRoute.seed,
          policy: summonRoute.policy,
          boost: summonRoute.boost,
        },
      }),
    );
  },
  30000,
);
