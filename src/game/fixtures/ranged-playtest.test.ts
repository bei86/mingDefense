import { expect, test } from 'vitest';
import { clone, stages } from '../content';
import { waveSpawns } from '../combat';
import { validSave } from '../persistence';
import { Session } from '../session';
import { simulate } from '../testing/campaign-simulation';
import { runPreparedBattle } from '../testing/campaign-battle';
import { withRangedPressure } from '../testing/ranged-pressure';
import {
  rangedCases,
  createRangedPlaytest,
  parseRangedPlaytest,
  rangedPlaytestUrl,
} from './ranged-playtest';

test.each(['relief', 'setback', 'carryover'] as const)(
  '%s开局逐字段来自正常经济路线，两方案战斗等于实验回放',
  (id) => {
    const source = rangedCases[id];
    const route = simulate(source.seed, source.policy, source.boost, 8);
    const original = clone(stages);
    for (const variant of ['baseline', 'candidate'] as const) {
      const trial = createRangedPlaytest({ caseId: id, variant });
      expect(validSave(trial.session.exportSave())).toBe(true);
      expect(trial.session.exportSave()).toEqual(route.checkpoints[7]);
      const expected = withRangedPressure(variant === 'candidate' ? 'stage8' : 'baseline', () =>
        runPreparedBattle(Session.restore(route.checkpoints[7]), source.policy, source.boost),
      );
      expect(runPreparedBattle(trial.session, source.policy, source.boost)).toEqual(expected);
      expect(trial.session.nextStage()).toBeTruthy();
      trial.session.backToPreparation();
      expect(trial.session.preparation).toEqual(route.checkpoints[7].preparation);
      trial.session.preparation.currency++;
      expect(trial.session.retry()).toBeNull();
      expect(trial.session.preparation).toEqual(route.checkpoints[7].preparation);
      expect(trial.session.battle!.spawns).toEqual(trial.spawns);
      trial.session.reset();
      expect(trial.session.exportSave()).toEqual(route.checkpoints[7]);
    }
    expect(stages).toEqual(original);
  },
);

test('候选只替换本实例调度，失败重入不覆盖，返回布阵及重试保持候选', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  const session = trial.session;
  const opening = session.exportSave();
  const schedule = withRangedPressure('stage8', () => waveSpawns(8));
  const baseline = waveSpawns(8);
  expect(schedule.map(({ at, x }) => ({ at, x }))).toEqual(
    baseline.map(({ at, x }) => ({ at, x })),
  );
  expect(schedule.filter((s) => s.kind === 'ranged')).toHaveLength(9);
  expect(schedule.filter((s) => s.kind === 'wolf')).toHaveLength(15);
  expect(session.start()).toBeNull();
  expect(session.battle!.spawns).toEqual(schedule);
  session.battle!.spawns.pop();
  expect(session.start()).toBeTruthy();
  session.backToPreparation();
  expect(session.start()).toBeNull();
  expect(session.battle!.spawns).toEqual(schedule);
  session.preparation.currency++;
  session.reset();
  expect(session.exportSave()).toEqual(opening);
  expect(session.retry()).toBeNull();
  expect(session.battle!.spawns).toEqual(schedule);
  expect(waveSpawns(8)).toEqual(baseline);
});

test('参数回退与链接仅携带固定试玩参数', () => {
  expect(parseRangedPlaytest('?case=oops&variant=oops')).toEqual({
    caseId: 'relief',
    variant: 'baseline',
  });
  expect(parseRangedPlaytest('?case=setback&variant=candidate')).toEqual({
    caseId: 'setback',
    variant: 'candidate',
  });
  expect(rangedPlaytestUrl({ caseId: 'carryover', variant: 'candidate' })).toBe(
    '?playtest=ranged8&case=carryover&variant=candidate',
  );
});

test('空阵启动失败不创建战斗，重置恢复完整开局', () => {
  const { session } = createRangedPlaytest({ caseId: 'setback', variant: 'candidate' });
  const opening = session.exportSave();
  session.preparation.units.forEach((unit) => {
    unit.position = null;
  });
  expect(session.start()).toBeTruthy();
  expect(session.battle).toBeNull();
  expect(session.phase).toBe('prepare');
  session.reset();
  expect(session.exportSave()).toEqual(opening);
});
