import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.EXPORT_APPROACH_SAMPLES !== '1')(
  'export current three-cell samples',
  () => {
    const runs = Array.from({ length: 12 }, (_, i) => 20261014 + i).flatMap((seed) =>
      Object.keys(orders).flatMap((policy) =>
        [true, false].map((boost) => ({ ...simulate(seed, policy, boost, 40, true), boost })),
      ),
    );
    const summary = {
      contentVersion: config.contentVersion,
      spawnRow: config.waves.spawnRow,
      runs: runs.length,
      completed: runs.filter((r) => r.complete).length,
      stages: config.stages.map(({ id }) => ({
        stage: id,
        reached: runs.filter((r) => r.results.length >= id).length,
        won: runs.filter((r) => r.results[id - 1]?.result === 'victory').length,
      })),
    };
    console.log(JSON.stringify(summary));
    mkdirSync('artifacts', { recursive: true });
    writeFileSync(
      'artifacts/approach-distance-samples.json',
      JSON.stringify({ summary, runs }, null, 2),
    );
  },
  30000,
);
