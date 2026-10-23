import type { StoragePort } from '../game/persistence';
import {
  readReports,
  REPORT_COLLECTION_KEY,
  REPORT_COLLECTION_LIMIT,
  type CollectedReport,
  type ReportLibrary,
} from './report-collection';

export const MAX_REPORT_BACKUP_BYTES = 1024 * 1024;
export const REPORT_BACKUP_FILE_NAME = 'ming-defense-report-collection.json';
const BACKUP_KIND = 'ming-defense-report-collection';
type Failure = { ok: false; error: string };
type Inspection = Failure | { ok: true; entries: CollectedReport[] };
export type ReportImportPlan =
  | Failure
  | {
      ok: true;
      base: string;
      entries: CollectedReport[];
      additions: CollectedReport[];
      duplicates: number;
    };

function libraryText(entries: CollectedReport[]): string {
  return JSON.stringify({ schemaVersion: 1, entries });
}

// Keep field, duplicate, per-document and library-size validation in the existing reader.
function validateEntries(entries: unknown): ReportLibrary {
  return readReports({
    getItem: () => JSON.stringify({ schemaVersion: 1, entries }),
    setItem: () => {},
    removeItem: () => {},
  });
}

export function createReportBackup(
  storage: StoragePort,
): Failure | { ok: true; text: string; count: number } {
  const library = readReports(storage);
  if (library.error) return { ok: false, error: library.error };
  if (!library.entries.length) return { ok: false, error: '还没有收藏可备份。' };
  return {
    ok: true,
    text: JSON.stringify({ kind: BACKUP_KIND, schemaVersion: 1, entries: library.entries }),
    count: library.entries.length,
  };
}

export function inspectReportBackup(text: string): Inspection {
  if (
    text.length > MAX_REPORT_BACKUP_BYTES ||
    new TextEncoder().encode(text).length > MAX_REPORT_BACKUP_BYTES
  )
    return { ok: false, error: '收藏备份不能超过1MiB。' };
  try {
    const value: unknown = JSON.parse(text);
    if (
      !value ||
      typeof value !== 'object' ||
      !('kind' in value) ||
      value.kind !== BACKUP_KIND ||
      !('schemaVersion' in value) ||
      value.schemaVersion !== 1 ||
      !('entries' in value)
    )
      return { ok: false, error: '不是支持的战报收藏备份；请勿使用战役存档或单篇Markdown。' };
    const library = validateEntries(value.entries);
    if (library.error) return { ok: false, error: '备份记录无效或超限，未导入任何战报。' };
    return { ok: true, entries: library.entries };
  } catch {
    return { ok: false, error: '备份文本无法解析，请复制完整JSON或重新选择文件。' };
  }
}

function planAgainst(current: ReportLibrary, text: string): ReportImportPlan {
  if (current.error) return { ok: false, error: current.error };
  const inspection = inspectReportBackup(text);
  if (!inspection.ok) return inspection;
  const existing = new Set(current.entries.map((entry) => entry.document.text));
  const incoming = inspection.entries.filter((entry) => !existing.has(entry.document.text));
  if (current.entries.length + incoming.length > REPORT_COLLECTION_LIMIT)
    return {
      ok: false,
      error: `合并后超过10个收藏位；本地${current.entries.length}份，本次新增${incoming.length}份。请先整理收藏后重新校验，不会部分导入。`,
    };
  let id = Math.max(0, ...current.entries.map((entry) => entry.id));
  if (!Number.isSafeInteger(id + incoming.length))
    return { ok: false, error: '收藏编号已达上限，未导入。' };
  const additions = [...incoming]
    .reverse()
    .map((entry) => ({ ...entry, id: ++id }))
    .reverse();
  const entries = [...additions, ...current.entries];
  if (validateEntries(entries).error)
    return { ok: false, error: '合并后的收藏超过存储大小限制，未导入。' };
  return {
    ok: true,
    base: JSON.stringify(current.entries),
    entries,
    additions,
    duplicates: inspection.entries.length - incoming.length,
  };
}

export function planReportImport(storage: StoragePort, text: string): ReportImportPlan {
  return planAgainst(readReports(storage), text);
}

export function importReportBackup(
  storage: StoragePort,
  text: string,
  expectedBase: string,
): {
  library: ReportLibrary;
  error: string | null;
  added: number;
  duplicates: number;
} {
  const library = readReports(storage);
  const plan = planAgainst(library, text);
  const fail = (error: string) => ({ library, error, added: 0, duplicates: 0 });
  if (!plan.ok) return fail(plan.error);
  if (plan.base !== expectedBase) return fail('收藏已变化，请重新校验备份后再确认。');
  if (!plan.additions.length)
    return { library, error: null, added: 0, duplicates: plan.duplicates };
  try {
    storage.setItem(REPORT_COLLECTION_KEY, libraryText(plan.entries));
    return {
      library: { entries: plan.entries, error: null },
      error: null,
      added: plan.additions.length,
      duplicates: plan.duplicates,
    };
  } catch {
    return fail('保存失败，原收藏未替换；请检查浏览器存储空间后重新校验。');
  }
}

export async function readReportBackupFile(
  file: Pick<File, 'size' | 'text'>,
): Promise<Failure | { ok: true; text: string }> {
  if (file.size > MAX_REPORT_BACKUP_BYTES) return { ok: false, error: '收藏备份不能超过1MiB。' };
  try {
    const text = await file.text();
    const result = inspectReportBackup(text);
    return result.ok ? { ok: true, text } : result;
  } catch {
    return { ok: false, error: '文件读取失败，请重新选择或粘贴文本。' };
  }
}
