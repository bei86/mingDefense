import { describe, expect, it, vi } from 'vitest';
import { Session } from '../game/session';
import type { StoragePort } from '../game/persistence';
import {
  REPORT_COLLECTION_KEY,
  addReport,
  readReports,
  removeReport,
  reportSnapshot,
  temporaryReportStorage,
} from './report-collection';

function finished(win = true) {
  const s = new Session();
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  if (win) {
    s.transfer({ type: 'offer', id: 2 }, { merge: 5 });
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  }
  s.start();
  for (let i = 0; i < 10000 && (s.phase === 'combat' || s.hasChoices); i++) {
    if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
    else s.tick();
  }
  expect(s.phase).toBe(win ? 'victory' : 'defeat');
  return s;
}

const draft = () => reportSnapshot(finished(), false)!;

describe('独立战报收藏', () => {
  it('真实胜利快照完整独立，进入下一关和重读后保留，不改Session或其他存储', () => {
    const s = finished();
    const storage = temporaryReportStorage();
    storage.setItem('ming-defense:campaign', 'unchanged');
    const before = JSON.stringify(s);
    const snapshot = reportSnapshot(s, false)!;
    const result = addReport(storage, snapshot, 1000);
    expect(result.error).toBeNull();
    expect(result.entries[0]).toMatchObject({
      createdAt: 1000,
      stageId: 1,
      result: 'victory',
      document: snapshot.document,
    });
    expect(JSON.stringify(s)).toBe(before);
    const original = snapshot.document.text;
    snapshot.document.text = 'changed';
    result.entries[0].document.text = 'changed too';
    expect(readReports(storage).entries[0].document.text).toBe(original);
    expect(s.nextStage()).toBeNull();
    expect(readReports(storage).entries[0].stageId).toBe(1);
    expect(storage.getItem('ming-defense:campaign')).toBe('unchanged');
  });

  it('真实失败快照不含旧胜利收入；未结束和未结算不能收藏', () => {
    const s = finished(false);
    s.lastReward = 987;
    const before = JSON.stringify(s);
    const snapshot = reportSnapshot(s, false)!;
    expect(snapshot.result).toBe('defeat');
    expect(snapshot.document.text).toContain('实际入账：0');
    expect(snapshot.document.text).not.toContain('987');
    expect(JSON.stringify(s)).toBe(before);
    expect(reportSnapshot(new Session(), false)).toBeNull();
    const win = finished();
    win.settled = false;
    expect(reportSnapshot(win, false)).toBeNull();
  });

  it('同文本去重不写、不更新时间，最新收藏排前且ID在同毫秒不冲突', () => {
    const storage = temporaryReportStorage();
    const set = vi.spyOn(storage, 'setItem');
    const snapshot = draft();
    const first = addReport(storage, snapshot, 1000).entries[0];
    set.mockClear();
    const duplicate = addReport(storage, snapshot, 2000);
    expect(duplicate.entries).toEqual([first]);
    expect(duplicate.duplicate).toBe(true);
    expect(set).not.toHaveBeenCalled();
    snapshot.document.text += '\n另一场';
    const second = addReport(storage, snapshot, 1000);
    expect(second.entries).toHaveLength(2);
    expect(second.entries[0].id).toBeGreaterThan(first.id);
  });

  it('10个收藏位满后不淘汰；可去重但新文档需先删除', () => {
    const storage = temporaryReportStorage();
    const snapshot = draft();
    for (let i = 0; i < 10; i++) {
      expect(
        addReport(
          storage,
          {
            ...snapshot,
            document: { ...snapshot.document, text: `${snapshot.document.text}\n${i}` },
          },
          1000,
        ).error,
      ).toBeNull();
    }
    const before = storage.getItem(REPORT_COLLECTION_KEY);
    expect(addReport(storage, snapshot, 2000).error).toContain('已满');
    expect(storage.getItem(REPORT_COLLECTION_KEY)).toBe(before);
    expect(
      addReport(storage, { ...snapshot, document: readReports(storage).entries[0].document }, 2000)
        .duplicate,
    ).toBe(true);
    const selected = readReports(storage).entries[4];
    expect(removeReport(storage, selected.id).entries).toHaveLength(9);
    expect(readReports(storage).entries.some((e) => e.id === selected.id)).toBe(false);
    expect(addReport(storage, snapshot, 2000).entries).toHaveLength(10);
  });

  it('每次写入和删除均先重读，保留另一页面新增条目；未知ID不写', () => {
    const storage = temporaryReportStorage();
    const snapshot = draft();
    const first = addReport(storage, snapshot, 1000).entries[0];
    const another = { ...snapshot, document: { ...snapshot.document, text: '另一页面收藏' } };
    addReport(storage, another, 1001);
    expect(removeReport(storage, first.id).entries.map((e) => e.document.text)).toEqual([
      '另一页面收藏',
    ]);
    const before = storage.getItem(REPORT_COLLECTION_KEY);
    expect(removeReport(storage, -1).error).toBeTruthy();
    expect(storage.getItem(REPORT_COLLECTION_KEY)).toBe(before);
  });

  it.each([
    'not json',
    'null',
    '{"schemaVersion":2,"entries":[]}',
    '{"schemaVersion":1,"entries":[{}]}',
    ' '.repeat(786433),
  ])('坏库保留原文，禁止新增和删除 %#', (raw) => {
    const storage = temporaryReportStorage();
    storage.setItem(REPORT_COLLECTION_KEY, raw);
    expect(readReports(storage).error).toBeTruthy();
    expect(addReport(storage, draft(), 1000).error).toBeTruthy();
    expect(removeReport(storage, 1).error).toBeTruthy();
    expect(storage.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
  });

  it.each([
    { stageId: 0 },
    { stageId: 51 },
    { result: 'combat' },
    { document: { fileName: '../bad.md', text: 'valid' } },
    { document: { fileName: 'ming-defense-report-stage-1-victory.md', text: '中'.repeat(22000) } },
  ])('无效新快照不写入 %#', (patch) => {
    const storage = temporaryReportStorage();
    expect(
      addReport(storage, { ...draft(), ...patch } as ReturnType<typeof draft>, 1000).error,
    ).toBeTruthy();
    expect(storage.getItem(REPORT_COLLECTION_KEY)).toBeNull();
  });

  it('持久化字段损坏、重复ID或文本、11条及非有限时间均阻止覆盖', () => {
    const storage = temporaryReportStorage();
    const entry = addReport(storage, draft(), 1000).entries[0];
    for (const entries of [
      [{ ...entry, id: 0 }],
      [{ ...entry, createdAt: 'yesterday' }],
      [entry, { ...entry, document: { ...entry.document, text: 'other' } }],
      [entry, { ...entry, id: 1001 }],
      Array.from({ length: 11 }, () => entry),
    ]) {
      const raw = JSON.stringify({ schemaVersion: 1, entries });
      storage.setItem(REPORT_COLLECTION_KEY, raw);
      expect(readReports(storage).error).toBeTruthy();
      expect(addReport(storage, draft(), 1001).error).toBeTruthy();
      expect(storage.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
    }
    expect(addReport(temporaryReportStorage(), draft(), Infinity).error).toBeTruthy();
  });

  it('读取失败不写；写入失败保留原库及有效列表，不假报新增或删除成功', () => {
    const getItem = vi.fn(() => {
      throw new Error('blocked');
    });
    const setItem = vi.fn();
    const blocked: StoragePort = { getItem, setItem, removeItem: vi.fn() };
    expect(addReport(blocked, draft(), 1000).error).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    const storage = temporaryReportStorage();
    const first = addReport(storage, draft(), 1000).entries[0];
    const raw = storage.getItem(REPORT_COLLECTION_KEY);
    const fail = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const result = addReport(storage, reportSnapshot(finished(false), false)!, 1001);
    expect(result.error).toContain('保存失败');
    expect(result.entries).toEqual([first]);
    expect(removeReport(storage, first.id).entries).toEqual([first]);
    expect(storage.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
    fail.mockRestore();
    expect(removeReport(storage, first.id).entries).toEqual([]);
  });

  it('隔离存储实例独立且无浏览器依赖，快照明确开发来源', () => {
    const first = temporaryReportStorage();
    const next = temporaryReportStorage();
    const s = finished();
    const snapshot = reportSnapshot(s, true)!;
    expect(snapshot.document.text).toContain('来源：开发隔离试玩');
    addReport(first, snapshot, 1000);
    expect(readReports(first).entries).toHaveLength(1);
    expect(readReports(next).entries).toEqual([]);
    first.removeItem(REPORT_COLLECTION_KEY);
    expect(readReports(first).entries).toEqual([]);
  });
});
