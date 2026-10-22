import { afterAll, beforeAll } from 'vitest';
import { clone, config, type Stage } from '../content';
import v15 from '../../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

/** Only the fields explicitly calibrated after v17; all mechanics tests use live values. */
function restoreHistoricalNumbers(target: typeof config): void {
  for (const key of [
    'thirdBoss',
    'fourthBoss',
    'fifthBoss',
    'sixthBoss',
    'seventhBoss',
    'eighthBoss',
  ] as const)
    target[key].hp = v15[key].hp;
  target.stages[36].attackMultiplier = v15.stages[36].attackMultiplier;
  target.stages[38].hpMultiplier = v15.stages[38].hpMultiplier;
  target.stages[32].hpMultiplier = v15.stages[32].hpMultiplier;
  target.stages[27].hpMultiplier = v15.stages[27].hpMultiplier;
  target.stages[28].attackMultiplier = v15.stages[28].attackMultiplier;
  for (const index of [24, 29, 34, 39])
    (target.stages[index] as Stage).waves.forEach((wave, i) => {
      wave.enemies.ranged = (v15.stages[index] as Stage).waves[i].enemies.ranged;
      wave.atMs = v15.stages[index].waves[i].atMs;
    });
  target.enemies.find((e) => e.id === 'ranged')!.hitDamage = v15.enemies.find(
    (e) => e.id === 'ranged',
  )!.hitDamage;
}

/** For historical snapshot comparisons only, without mutating live configuration. */
export function historicalBalance(): Omit<typeof config, 'ninthBoss' | 'tenthBoss'> {
  const historical = clone(config);
  restoreHistoricalNumbers(historical);
  historical.stages = historical.stages.slice(0, 40);
  historical.scope.M2M3.stageIds = historical.scope.M2M3.stageIds.slice(0, 40);
  const { ninthBoss: _ninthBoss, tenthBoss: _tenthBoss, ...prefix } = historical;
  return prefix;
}

/** Historical campaign goldens pin pre-v16 distance AND pre-v18/v19/v20/v21/v22 numerical balance. */
export function useLegacyApproach(): void {
  const original = clone(config);
  beforeAll(() => {
    restoreHistoricalNumbers(config);
    config.waves.spawnRow = -1;
  });
  afterAll(() => {
    config.waves.spawnRow = original.waves.spawnRow;
    for (const key of [
      'thirdBoss',
      'fourthBoss',
      'fifthBoss',
      'sixthBoss',
      'seventhBoss',
      'eighthBoss',
    ] as const)
      config[key].hp = original[key].hp;
    config.stages[36].attackMultiplier = original.stages[36].attackMultiplier;
    config.stages[38].hpMultiplier = original.stages[38].hpMultiplier;
    config.stages[32].hpMultiplier = original.stages[32].hpMultiplier;
    config.stages[27].hpMultiplier = original.stages[27].hpMultiplier;
    config.stages[28].attackMultiplier = original.stages[28].attackMultiplier;
    for (const index of [24, 29, 34, 39])
      (config.stages[index] as Stage).waves.forEach((wave, i) => {
        wave.enemies.ranged = (original.stages[index] as Stage).waves[i].enemies.ranged;
        wave.atMs = original.stages[index].waves[i].atMs;
      });
    config.enemies.find((e) => e.id === 'ranged')!.hitDamage = original.enemies.find(
      (e) => e.id === 'ranged',
    )!.hitDamage;
  });
}
