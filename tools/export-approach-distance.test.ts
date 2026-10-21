import { test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { config } from '../src/game/content';
import { simulate, orders } from '../src/game/testing/campaign-simulation';

test.skipIf(process.env.EXPORT_APPROACH_SAMPLES !== '1')(
  'export current three-cell samples',
  async () => {
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
      stage20Policies: Object.keys(orders).map((policy) => ({
        policy,
        won: runs.filter((r) => r.policy === policy && r.results[19]?.result === 'victory').length,
      })),
      stage25Policies: Object.keys(orders).map((policy) => ({
        policy,
        won: runs.filter((r) => r.policy === policy && r.results[24]?.result === 'victory').length,
      })),
      stage30Policies: Object.keys(orders).map((policy) => ({
        policy,
        won: runs.filter((r) => r.policy === policy && r.results[29]?.result === 'victory').length,
      })),
      stage35Policies: Object.keys(orders).map((policy) => ({
        policy,
        won: runs.filter((r) => r.policy === policy && r.results[34]?.result === 'victory').length,
      })),
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
    if (process.env.UPDATE_THREE_CELL_FIXTURE === '1') {
      const viable = runs.find((r) => !r.boost && r.results[19]?.result === 'victory');
      if (!viable) throw new Error('No legal unboosted stage-20 route');
      const path = 'src/game/fixtures/calibration-20-checkpoint.json';
      writeFileSync(
        path,
        await format(JSON.stringify(viable.checkpoints[19]), {
          ...(await resolveConfig(path)),
          parser: 'json',
        }),
      );
      console.log(
        JSON.stringify({
          checkpoint: path,
          seed: viable.seed,
          policy: viable.policy,
          boost: viable.boost,
        }),
      );
    }
    if (process.env.UPDATE_STAGE25_CALIBRATION_FIXTURE === '1') {
      const viable = runs.find((r) => !r.boost && r.results[24]?.result === 'victory');
      if (!viable) throw new Error('No legal unboosted stage-25 route');
      const path = 'src/game/fixtures/calibration-25-checkpoint.json';
      writeFileSync(
        path,
        await format(JSON.stringify(viable.checkpoints[24]), {
          ...(await resolveConfig(path)),
          parser: 'json',
        }),
      );
      console.log(
        JSON.stringify({
          checkpoint: path,
          seed: viable.seed,
          policy: viable.policy,
          boost: viable.boost,
        }),
      );
    }
    if (process.env.UPDATE_STAGE30_CALIBRATION_FIXTURE === '1') {
      const viable = runs.find((r) => !r.boost && r.results[29]?.result === 'victory');
      if (!viable) throw new Error('No legal unboosted stage-30 route');
      const path = 'src/game/fixtures/calibration-30-checkpoint.json';
      writeFileSync(
        path,
        await format(JSON.stringify(viable.checkpoints[29]), {
          ...(await resolveConfig(path)),
          parser: 'json',
        }),
      );
      console.log(
        JSON.stringify({
          checkpoint: path,
          seed: viable.seed,
          policy: viable.policy,
          boost: viable.boost,
        }),
      );
    }
    if (process.env.UPDATE_STAGE35_CALIBRATION_FIXTURE === '1') {
      const viable = runs.find((r) => !r.boost && r.results[34]?.result === 'victory');
      if (!viable) throw new Error('No legal unboosted stage-35 route');
      const path = 'src/game/fixtures/calibration-35-checkpoint.json';
      writeFileSync(
        path,
        await format(JSON.stringify(viable.checkpoints[34]), {
          ...(await resolveConfig(path)),
          parser: 'json',
        }),
      );
      console.log(
        JSON.stringify({
          checkpoint: path,
          seed: viable.seed,
          policy: viable.policy,
          boost: viable.boost,
        }),
      );
    }
  },
  30000,
);
