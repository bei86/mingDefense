import { writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { simulate } from '../src/game/testing/campaign-simulation';

test.runIf(process.env.EXPORT_RANGED_PLAYTEST === '1')(
  '导出第8关三个合法经济开局',
  () => {
    const cases = [
      ['relief', 20270105, 'assault', false],
      ['setback', 20270115, 'assault', false],
      ['carryover', 20270112, 'control', true],
    ] as const;
    for (const [id, seed, policy, boost] of cases) {
      const route = simulate(seed, policy, boost, 8);
      const checkpoint = route.checkpoints[7];
      expect(checkpoint?.preparation.stageId).toBe(8);
      writeFileSync(
        `src/game/fixtures/ranged8-${id}-checkpoint.json`,
        JSON.stringify(checkpoint, null, 2) + '\n',
      );
    }
  },
  60_000,
);
