import { afterAll, beforeAll } from 'vitest';
import { config } from '../content';

/** Historical campaign goldens use the pre-v16 one-cell approach only. */
export function useLegacyApproach(): void {
  const spawnRow = config.waves.spawnRow;
  beforeAll(() => {
    config.waves.spawnRow = -1;
  });
  afterAll(() => {
    config.waves.spawnRow = spawnRow;
  });
}
