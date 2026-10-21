import { afterAll, beforeAll } from 'vitest';
import { clone, config } from '../content';
import v15 from '../../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

/** Only the fields explicitly calibrated after v17; all mechanics tests use live values. */
function restoreHistoricalNumbers(target: typeof config): void {
  for (const key of ['thirdBoss', 'fourthBoss'] as const) target[key].hp = v15[key].hp;
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

/** Historical campaign goldens pin pre-v16 distance AND pre-v18 numerical balance. */
export function useLegacyApproach(): void {
  const original = clone(config);
  beforeAll(() => {
    restoreHistoricalNumbers(config);
    config.waves.spawnRow = -1;
  });
  afterAll(() => {
    config.waves.spawnRow = original.waves.spawnRow;
    for (const key of ['thirdBoss', 'fourthBoss'] as const) config[key].hp = original[key].hp;
    config.enemies.find((e) => e.id === 'ranged')!.hitDamage = original.enemies.find(
      (e) => e.id === 'ranged',
    )!.hitDamage;
  });
}
