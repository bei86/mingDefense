import { expect, test } from 'vitest';
import { clone, config } from '../game/content';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import { runPreparedBattle } from '../game/testing/campaign-battle';
import { temporaryReportStorage } from './report-collection';
import {
  RANGED_RESULTS_KEY,
  rangedResult,
  readRangedResults,
  saveRangedResult,
  clearRangedResults,
  rangedComparison,
  rangedResultsDocument,
} from './ranged-results';

function completed(
  variant: 'baseline' | 'candidate' = 'baseline',
  caseId: 'relief' | 'setback' = 'relief',
) {
  const trial = createRangedPlaytest({ caseId, variant });
  runPreparedBattle(trial.session, 'assault', false);
  return { trial, result: rangedResult(trial, 1000)! };
}

test('只记录完成结算的真实胜败，快照独立且不改变游戏', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  expect(rangedResult(trial)).toBeNull();
  trial.session.start();
  expect(rangedResult(trial)).toBeNull();
  trial.session.backToPreparation();
  runPreparedBattle(trial.session, 'assault', false);
  const before = clone(trial.session.exportSave());
  const result = rangedResult(trial, 1000)!;
  expect(result.result).toBe('victory');
  expect(result.hp).toBe(1695);
  expect(result.damageTaken).toBe(3619);
  expect(result.opening.preparation.currency).toBe(14);
  expect(result.opening.preparation.progression.level).toBe(8);
  expect(trial.session.exportSave()).toEqual(before);
  result.opening.preparation.currency++;
  expect(rangedResult(trial, 1000)!.opening.preparation.currency).toBe(14);
  trial.session.settled = false;
  expect(rangedResult(trial)).toBeNull();
  trial.session.settled = true;
  trial.session.battle!.pendingChoices = 1;
  expect(rangedResult(trial)).toBeNull();
  const loss = completed().result;
  expect(loss.result).toBe('defeat');
  expect(loss.hp).toBe(0);
  expect(loss.income).toBe(0);
});

test('成功开战档包含手动布阵，失败启动不覆盖，返回和重试更新快照', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'baseline' });
  const s = trial.session;
  expect(s.battleOpening).toBeNull();
  s.preparation.units.find((u) => u.kind === 'ember_mouse' && u.rank === 1)!.position = {
    x: 4,
    y: 1,
  };
  const opening = s.exportSave();
  expect(s.start()).toBeNull();
  expect(s.battleOpening).toEqual(opening);
  expect(s.start()).toBeTruthy();
  expect(s.battleOpening).toEqual(opening);
  s.backToPreparation();
  s.start();
  expect(s.battleOpening?.preparation).toEqual(opening.preparation);
  s.reset();
  expect(s.battleOpening).toBeNull();
  s.retry();
  expect(s.battleOpening?.preparation).not.toEqual(opening.preparation);
});

test('按案例及方案最近覆盖，读取克隆且不访问其他key', () => {
  const storage = temporaryReportStorage();
  storage.setItem('ming-defense:campaign', 'formal-sentinel');
  const baseline = completed().result;
  const candidate = completed('candidate').result;
  saveRangedResult(storage, baseline);
  saveRangedResult(storage, candidate);
  const updated = { ...baseline, capturedAt: 2000, damageTaken: baseline.damageTaken + 1 };
  expect(saveRangedResult(storage, updated).entries).toHaveLength(2);
  const other = completed('candidate', 'setback').result;
  saveRangedResult(storage, other);
  expect(readRangedResults(storage).entries).toHaveLength(3);
  expect(rangedComparison(readRangedResults(storage).entries, 'relief').baseline?.damageTaken).toBe(
    updated.damageTaken,
  );
  const loaded = readRangedResults(storage);
  loaded.entries[0].opening.preparation.currency++;
  expect(readRangedResults(storage)).not.toEqual(loaded);
  expect(storage.getItem('ming-defense:campaign')).toBe('formal-sentinel');
  expect(clearRangedResults(storage)).toEqual({ entries: [], error: null });
  expect(storage.getItem(RANGED_RESULTS_KEY)).toBeNull();
  expect(storage.getItem('ming-defense:campaign')).toBe('formal-sentinel');
});

test('单边不伪造数据，双边只比较开局/累计天赋/实际聚灵事实', () => {
  const baseline = completed().result;
  const candidate = completed('candidate').result;
  expect(rangedComparison([baseline], 'relief').openingSame).toBeNull();
  expect(rangedResultsDocument([baseline], 'relief').text).toContain('未试玩');
  expect(rangedComparison([baseline, candidate], 'relief')).toMatchObject({
    openingSame: true,
    talentsSame: false,
    boostSame: true,
  });
  expect(
    rangedComparison([baseline, { ...candidate, finalBuffs: clone(baseline.finalBuffs) }], 'relief')
      .talentsSame,
  ).toBe(true);
  const changed = clone(candidate);
  changed.opening.preparation.currency++;
  changed.finalBuffs.health = 2;
  changed.boostedMs = 50;
  expect(rangedComparison([baseline, changed], 'relief')).toMatchObject({
    openingSame: false,
    talentsSame: false,
    boostSame: false,
  });
  const report = rangedResultsDocument([baseline, candidate], 'relief');
  expect(report.fileName).toBe('ming-defense-ranged8-relief-comparison.md');
  expect(report.text).toContain(config.contentVersion);
  expect(report.text).toContain('1695');
  expect(report.text).toContain('3619');
  expect(report.text).toContain('不能证明');
  expect(report.text).toContain('开战阵容');
});

test.each([
  (v: any) => {
    v.contentVersion = 'old';
  },
  (v: any) => {
    v.schemaVersion = 0;
  },
  (v: any) => {
    v.trialVersion = 'old';
  },
  (v: any) => {
    v.entries.push(v.entries[0]);
  },
  (v: any) => {
    v.entries[0].time = -1;
  },
  (v: any) => {
    v.entries[0].hp = null;
  },
  (v: any) => {
    v.entries[0].capturedAt = 9e15;
  },
  (v: any) => {
    v.entries[0].opening.preparation.stageId = 9;
  },
  (v: any) => {
    v.entries[0].finalBuffs.health = 9999;
  },
])('拒绝损坏或旧格式并保留原文 %#', (damage) => {
  const storage = temporaryReportStorage();
  const result = completed().result;
  saveRangedResult(storage, result);
  const value = JSON.parse(storage.getItem(RANGED_RESULTS_KEY)!);
  damage(value);
  const raw = JSON.stringify(value);
  storage.setItem(RANGED_RESULTS_KEY, raw);
  expect(readRangedResults(storage).error).toBeTruthy();
  const failed = saveRangedResult(storage, result);
  expect(failed.error).toBeTruthy();
  expect(failed.entries).toHaveLength(1);
  expect(storage.getItem(RANGED_RESULTS_KEY)).toBe(raw);
});

test.each(['{', 'x'.repeat(512 * 1024 + 1)])('坏JSON或超大记录不覆盖原文', (raw) => {
  const storage = temporaryReportStorage();
  storage.setItem(RANGED_RESULTS_KEY, raw);
  expect(readRangedResults(storage).error).toBeTruthy();
  expect(storage.getItem(RANGED_RESULTS_KEY)).toBe(raw);
});

test('存储拒读写时当前结果仍可导出，清空失败保留原存储', () => {
  const result = completed().result;
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('quota');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  const failed = saveRangedResult(blocked, result);
  expect(failed.error).toBeTruthy();
  expect(failed.entries[0]).toEqual(result);
  expect(rangedResultsDocument(failed.entries, 'relief').text).toContain('失败');
  const storage = temporaryReportStorage();
  const noWrite = { ...storage, setItem: blocked.setItem, removeItem: blocked.removeItem };
  expect(saveRangedResult(noWrite, result).entries).toHaveLength(1);
  saveRangedResult(storage, result);
  const raw = storage.getItem(RANGED_RESULTS_KEY);
  expect(clearRangedResults(noWrite).error).toBeTruthy();
  expect(storage.getItem(RANGED_RESULTS_KEY)).toBe(raw);
  expect(saveRangedResult(storage, { ...result, hp: Infinity }).error).toBeTruthy();
});
