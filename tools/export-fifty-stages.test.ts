import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { config } from '../src/game/content';
import { orders, simulate } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.EXPORT_FIFTY !== '1')(
  'export 72 legal routes and 46/50 checkpoints',
  async () => {
    const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
      Object.keys(orders).flatMap((policy) =>
        [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 50, true), boost })),
      ),
    );
    const summary = {
      contentVersion: config.contentVersion,
      runs: runs.length,
      wins: Array.from(
        { length: 50 },
        (_, i) => runs.filter((r) => r.results[i]?.result === 'victory').length,
      ),
      policies: Object.keys(orders).map((policy) => ({
        policy,
        complete: runs.filter((r) => r.policy === policy && r.complete).length,
      })),
      completed: runs
        .filter((r) => r.complete)
        .map((r) => ({
          seed: r.seed,
          policy: r.policy,
          boost: r.boost,
          results: r.results.slice(45).map((b) => ({
            stage: b.stage,
            time: b.time,
            hp: b.hp,
            hpRatio: b.hpRatio,
            kills: b.kills,
          })),
        })),
    };
    mkdirSync('artifacts', { recursive: true });
    writeFileSync(
      'artifacts/fifty-stages-samples.json',
      JSON.stringify({ summary, runs }, null, 2),
    );
    console.log(JSON.stringify(summary));
    if (process.env.UPDATE_FIFTY_FIXTURE === '1') {
      const route = runs.find((r) => r.policy === 'control' && !r.boost && r.complete);
      if (!route) throw new Error('No legal unboosted control route to stage50');
      for (const stage of [46, 50]) {
        const path = `src/game/fixtures/stage-${stage}-checkpoint.json`;
        writeFileSync(
          path,
          await format(JSON.stringify(route.checkpoints[stage - 1]), {
            ...(await resolveConfig(path)),
            parser: 'json',
          }),
        );
      }
    }
  },
  120000,
);
