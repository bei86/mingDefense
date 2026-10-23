import { describe, expect, it, vi } from 'vitest';
import { Session } from '../game/session';
import {
  addReport,
  readReports,
  reportSnapshot,
  temporaryReportStorage,
  REPORT_COLLECTION_KEY,
  type ReportSnapshot,
} from './report-collection';
import {
  createReportBackup,
  inspectReportBackup,
  planReportImport,
  importReportBackup,
  readReportBackupFile,
  MAX_REPORT_BACKUP_BYTES,
} from './report-backup';

function snapshot(text = '战报原文'): ReportSnapshot {
  return {
    stageId: 1,
    result: 'victory',
    document: { fileName: 'ming-defense-report-stage-1-victory.md', text },
  };
}
function backup(...texts: string[]) {
  const storage = temporaryReportStorage();
  texts.forEach((text, i) => addReport(storage, snapshot(text), 1000 + i));
  const result = createReportBackup(storage);
  if (!result.ok) throw new Error(result.error);
  return result.text;
}
function apply(storage: ReturnType<typeof temporaryReportStorage>, text: string) {
  const plan = planReportImport(storage, text);
  if (!plan.ok) throw new Error(plan.error);
  return importReportBackup(storage, text, plan.base);
}

describe('战报收藏备份', () => {
  it('真实Session战报往返保留原文、关卡和时间，不改战役或来源库', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.start();
    for (let i = 0; i < 10000 && (s.phase === 'combat' || s.hasChoices); i++) {
      if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
      else s.tick();
    }
    expect(s.phase).toBe('defeat');
    const source = temporaryReportStorage();
    const report = reportSnapshot(s, true)!;
    expect(report.document.text).toContain('## 重伤时间线');
    expect(report.document.text).toContain('同一批灵兽不区分重伤先后');
    addReport(source, report, 1234);
    const before = JSON.stringify(s);
    const raw = source.getItem(REPORT_COLLECTION_KEY);
    const exported = createReportBackup(source);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.error);
    const target = temporaryReportStorage();
    target.setItem('campaign', 'keep');
    const result = apply(target, exported.text);
    expect(result.error).toBeNull();
    expect(result.added).toBe(1);
    expect(result.library.entries[0]).toMatchObject({ ...report, createdAt: 1234 });
    expect(readReports(target)).toEqual(result.library);
    expect(JSON.stringify(s)).toBe(before);
    expect(source.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
    expect(target.getItem('campaign')).toBe('keep');
  });

  it('ID冲突重新编号、时间保留、全文去重、一次写入且计划只读', () => {
    const target = temporaryReportStorage();
    addReport(target, snapshot('旧'), 1001);
    const original = readReports(target).entries[0];
    const set = vi.spyOn(target, 'setItem');
    set.mockClear();
    const text = backup('旧', '新');
    const plan = planReportImport(target, text);
    expect(set).not.toHaveBeenCalled();
    expect(plan).toMatchObject({ ok: true, duplicates: 1, additions: [{ createdAt: 1001 }] });
    if (!plan.ok) throw new Error(plan.error);
    const result = importReportBackup(target, text, plan.base);
    expect(set).toHaveBeenCalledTimes(1);
    expect(result.added).toBe(1);
    expect(result.library.entries.find((e) => e.document.text === '旧')).toEqual(original);
    expect(result.library.entries[0].id).toBeGreaterThan(original.id);
    expect(result.library.entries[0].createdAt).toBe(1001);
    set.mockClear();
    expect(apply(target, text)).toMatchObject({ error: null, added: 0, duplicates: 2 });
    expect(set).not.toHaveBeenCalled();
  });

  it('不部分导入、满库不淘汰但全部重复允许', () => {
    const target = temporaryReportStorage();
    for (let i = 0; i < 9; i++) addReport(target, snapshot(`原${i}`), i);
    const before = target.getItem(REPORT_COLLECTION_KEY);
    expect(planReportImport(target, backup('新1', '新2'))).toMatchObject({ ok: false });
    expect(target.getItem(REPORT_COLLECTION_KEY)).toBe(before);
    expect(apply(target, backup('新1')).error).toBeNull();
    expect(apply(target, backup('原0', '新1'))).toMatchObject({ added: 0, duplicates: 2 });
    expect(planReportImport(target, backup('新2'))).toMatchObject({ ok: false });
  });

  it('预览后其他页面新增时拒绝，重新校验后保留新数据', () => {
    const target = temporaryReportStorage();
    const text = backup('导入');
    const plan = planReportImport(target, text);
    if (!plan.ok) throw new Error(plan.error);
    addReport(target, snapshot('其他页面'), 2000);
    const raw = target.getItem(REPORT_COLLECTION_KEY);
    expect(importReportBackup(target, text, plan.base).error).toContain('重新校验');
    expect(target.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
    expect(apply(target, text).library.entries.map((e) => e.document.text)).toEqual([
      '导入',
      '其他页面',
    ]);
  });

  it('坏库、读异常、写异常均保留原数据，导出不报假成功', () => {
    const target = temporaryReportStorage();
    target.setItem(REPORT_COLLECTION_KEY, 'bad');
    expect(createReportBackup(target).ok).toBe(false);
    expect(planReportImport(target, backup('新')).ok).toBe(false);
    expect(importReportBackup(target, backup('新'), '').error).toBeTruthy();
    expect(target.getItem(REPORT_COLLECTION_KEY)).toBe('bad');
    expect(
      createReportBackup({
        ...target,
        getItem: () => {
          throw Error('read');
        },
      }).ok,
    ).toBe(false);
    const healthy = temporaryReportStorage();
    addReport(healthy, snapshot('旧'), 3);
    const raw = healthy.getItem(REPORT_COLLECTION_KEY);
    const blocked = {
      ...healthy,
      setItem: () => {
        throw Error('quota');
      },
    };
    const plan = planReportImport(blocked, backup('新'));
    if (!plan.ok) throw new Error(plan.error);
    expect(importReportBackup(blocked, backup('新'), plan.base)).toMatchObject({
      added: 0,
      library: { entries: [{ document: { text: '旧' } }] },
    });
    expect(healthy.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
  });

  it.each(['delete', 'edit'])('预览后其他页面%s也使确认失效，不覆盖最新内容', (action) => {
    const target = temporaryReportStorage();
    addReport(target, snapshot('原收藏'), 100);
    const text = backup('新收藏');
    const plan = planReportImport(target, text);
    if (!plan.ok) throw new Error(plan.error);
    const latest = JSON.parse(target.getItem(REPORT_COLLECTION_KEY)!);
    if (action === 'delete') latest.entries = [];
    else latest.entries[0].document.text = '其他页面修改的原文';
    const raw = JSON.stringify(latest);
    target.setItem(REPORT_COLLECTION_KEY, raw);
    const set = vi.spyOn(target, 'setItem');
    expect(importReportBackup(target, text, plan.base).error).toContain('重新校验');
    expect(set).not.toHaveBeenCalled();
    expect(target.getItem(REPORT_COLLECTION_KEY)).toBe(raw);
  });

  it('拒绝错误类型/版本/字段/文件名/重复记录及UTF8超限，HTML保持原文', () => {
    const text = backup('<script>不执行</script>');
    const value = JSON.parse(text);
    const entry = value.entries[0];
    const invalid = [
      '',
      '{}',
      '{',
      JSON.stringify({ ...value, kind: 'campaign' }),
      JSON.stringify({ ...value, schemaVersion: 2 }),
      JSON.stringify({ ...value, entries: [entry, entry] }),
      JSON.stringify({ ...value, entries: [{ ...entry, stageId: 51 }] }),
      JSON.stringify({ ...value, entries: [{ ...entry, createdAt: -1 }] }),
      JSON.stringify({
        ...value,
        entries: [{ ...entry, document: { ...entry.document, fileName: '../bad' } }],
      }),
      JSON.stringify({
        ...value,
        entries: [{ ...entry, document: { ...entry.document, text: '中'.repeat(22000) } }],
      }),
      '中'.repeat(360000),
    ];
    for (const input of invalid) expect(inspectReportBackup(input).ok).toBe(false);
    expect(inspectReportBackup(text)).toMatchObject({
      ok: true,
      entries: [{ document: { text: '<script>不执行</script>' } }],
    });
    expect(inspectReportBackup(JSON.stringify({ ...value, entries: [] })).ok).toBe(true);
    expect(createReportBackup(temporaryReportStorage()).ok).toBe(false);
  });

  it('安全ID耗尽与序列化库字节超限在预览阶段拒绝', () => {
    const target = temporaryReportStorage();
    addReport(target, snapshot('旧'), 3);
    const value = JSON.parse(target.getItem(REPORT_COLLECTION_KEY)!);
    value.entries[0].id = Number.MAX_SAFE_INTEGER;
    target.setItem(REPORT_COLLECTION_KEY, JSON.stringify(value));
    expect(planReportImport(target, backup('新')).ok).toBe(false);
    const large = temporaryReportStorage();
    for (let i = 0; i < 2; i++) addReport(large, snapshot(`${i}${'\n'.repeat(65520)}`), i);
    const incoming = JSON.parse(backup('新'));
    incoming.entries = Array.from({ length: 5 }, (_, i) => ({
      ...incoming.entries[0],
      id: i + 1,
      document: { ...incoming.entries[0].document, text: `新${i}${'\n'.repeat(65520)}` },
    }));
    expect(planReportImport(large, JSON.stringify(incoming)).ok).toBe(false);
  });

  it('文件超限在读取前拒绝，捕获读取失败，文本仍完整校验', async () => {
    const text = backup('文件');
    const read = vi.fn(async () => text);
    expect(
      await readReportBackupFile({ size: MAX_REPORT_BACKUP_BYTES + 1, text: read }),
    ).toMatchObject({ ok: false });
    expect(read).not.toHaveBeenCalled();
    expect(
      await readReportBackupFile({
        size: 1,
        text: async () => {
          throw Error('read');
        },
      }),
    ).toMatchObject({ ok: false });
    expect(await readReportBackupFile({ size: 1, text: async () => '{}' })).toMatchObject({
      ok: false,
    });
    expect(await readReportBackupFile({ size: text.length, text: read })).toMatchObject({
      ok: true,
      text,
    });
  });
});
