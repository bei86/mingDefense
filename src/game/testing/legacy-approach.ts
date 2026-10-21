import { afterAll, beforeAll } from 'vitest';
import { clone, config, type Stage } from '../content';
import v15 from '../../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

/** Only the fields explicitly calibrated after v17; all mechanics tests use live values. */
function restoreHistoricalNumbers(target: typeof config): void {
  for (const key of ['thirdBoss', 'fourthBoss', 'fifthBoss'] as const) target[key].hp = v15[key].hp;
  (target.stages[24] as Stage).waves.forEach((wave, i) => {
    wave.enemies.ranged = (v15.stages[24] as Stage).waves[i].enemies.ranged;
    wave.atMs = v15.stages[24].waves[i].atMs;
  });
  target.enemies.find((e) => e.id === 'ranged')!.hitDamage = v15.enemies.find(
    (e) => e.id === 'ranged',
  )!.hitDamage;
}

/** For historical snapshot comparisons only, without mutating live configuration. */
export function historicalBalance(): typeof config {
  const historical = clone(config);
  restoreHistoricalNumbers(historical);
  return historical;
}

/** Historical campaign goldens pin pre-v16 distance AND pre-v18/v19 numerical balance. */
export function useLegacyApproach(): void {
  const original = clone(config);
  beforeAll(() => {
    restoreHistoricalNumbers(config);
    config.waves.spawnRow = -1;
  });
  afterAll(() => {
    config.waves.spawnRow = original.waves.spawnRow;
    for (const key of ['thirdBoss', 'fourthBoss', 'fifthBoss'] as const)
      config[key].hp = original[key].hp;
    (config.stages[24] as Stage).waves.forEach((wave, i) => {
      wave.enemies.ranged = (original.stages[24] as Stage).waves[i].enemies.ranged;
      wave.atMs = original.stages[24].waves[i].atMs;
    });
    config.enemies.find((e) => e.id === 'ranged')!.hitDamage = original.enemies.find(
      (e) => e.id === 'ranged',
    )!.hitDamage;
  });
}
