import { expect, test, vi } from 'vitest';
import { validSave } from '../game/persistence';
import { Session } from '../game/session';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import finalCheckpoint from '../game/fixtures/stage-50-checkpoint.json';
import { runPreparedBattle } from '../game/testing/campaign-battle';
import { createReportBackup, importReportBackup, planReportImport } from './report-backup';
import {
  addReport,
  readReports,
  removeReport,
  reportSnapshot,
  temporaryReportStorage,
} from './report-collection';
import { reportCollectionView, type ReportCollectionFilter } from './report-collection-view';

function collected() {
  const storage = temporaryReportStorage();
  for (const [index, variant] of (['baseline', 'candidate'] as const).entries()) {
    const { session } = createRangedPlaytest({ caseId: 'relief', variant });
    runPreparedBattle(session, 'assault', false);
    expect(addReport(storage, reportSnapshot(session, true)!, 1000 + index).error).toBeNull();
  }
  if (!validSave(finalCheckpoint)) throw new Error('终战检查点无效');
  const session = Session.restore(finalCheckpoint);
  runPreparedBattle(session, 'control', false);
  expect(addReport(storage, reportSnapshot(session, true)!, 1002).error).toBeNull();
  return storage;
}

test('真实多关收藏按关卡和胜败取交集，保持最新顺序及原文', () => {
  const entries = readReports(collected()).entries;
  const before = JSON.stringify(entries);
  expect(reportCollectionView(entries, { stageId: null, result: 'all' }).entries).toEqual(entries);
  expect(
    reportCollectionView(entries, { stageId: 8, result: 'all' }).entries.map((e) => e.result),
  ).toEqual(['victory', 'defeat']);
  expect(
    reportCollectionView(entries, { stageId: null, result: 'victory' }).entries.map(
      (e) => e.stageId,
    ),
  ).toEqual([50, 8]);
  const view = reportCollectionView(entries, { stageId: 8, result: 'defeat' });
  expect(view.entries).toEqual([entries[2]]);
  expect(view.selected?.document).toEqual(entries[2].document);
  expect(JSON.stringify(entries)).toBe(before);
});

test('不符合筛选或已删除的选择只在匹配项内回退，无匹配不泄漏其他全文', () => {
  const entries = readReports(collected()).entries;
  const filter: ReportCollectionFilter = { stageId: 8, result: 'all' };
  expect(reportCollectionView(entries, filter, entries[0].id).selected?.id).toBe(entries[1].id);
  expect(reportCollectionView(entries, filter, entries[2].id).selected?.id).toBe(entries[2].id);
  expect(reportCollectionView(entries, filter, 9999).selected?.id).toBe(entries[1].id);
  expect(reportCollectionView(entries, { stageId: 50, result: 'defeat' }, entries[0].id)).toEqual({
    entries: [],
    selected: undefined,
  });
  expect(reportCollectionView([], filter)).toEqual({ entries: [], selected: undefined });
});

test('筛选后备份仍含全库；增删重读与导入重新派生，不写正式战役或重排原文', () => {
  const storage = collected();
  storage.setItem('campaign-sentinel', 'keep');
  const set = vi.spyOn(storage, 'setItem');
  const filter: ReportCollectionFilter = { stageId: 8, result: 'defeat' };
  const before = readReports(storage);
  const selected = reportCollectionView(before.entries, filter).selected!;
  const backup = createReportBackup(storage);
  if (!backup.ok) throw new Error(backup.error);
  expect(backup.count).toBe(3);
  expect(reportCollectionView(readReports(storage).entries, filter).entries).toHaveLength(1);
  expect(set).not.toHaveBeenCalled();
  expect(readReports(storage)).toEqual(before);
  const removed = removeReport(storage, selected.id);
  expect(removed.entries).toHaveLength(2);
  expect(reportCollectionView(removed.entries, filter, selected.id).selected).toBeUndefined();
  const plan = planReportImport(storage, backup.text);
  if (!plan.ok) throw new Error(plan.error);
  const restored = importReportBackup(storage, backup.text, plan.base);
  expect(restored.error).toBeNull();
  expect(restored.added).toBe(1);
  expect(reportCollectionView(restored.library.entries, filter).selected?.document).toEqual(
    selected.document,
  );
  expect(storage.getItem('campaign-sentinel')).toBe('keep');
});
