import type { StoragePort } from '../game/persistence';
import type { Session } from '../game/session';
import { battleReportDocument, type BattleReportDocument } from './battle-report-export';

export const REPORT_COLLECTION_KEY = 'ming-defense:report-collection';
export const REPORT_COLLECTION_LIMIT = 10;
export type ReportSnapshot = {
  stageId: number;
  result: 'victory' | 'defeat';
  document: BattleReportDocument;
};
export type CollectedReport = ReportSnapshot & { id: number; createdAt: number };
export type ReportLibrary = { entries: CollectedReport[]; error: string | null };
type AddResult = ReportLibrary & { duplicate?: boolean };
const MAX_LIBRARY_BYTES = 768 * 1024;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function withinBytes(text: string, max: number): boolean {
  return text.length <= max && new TextEncoder().encode(text).length <= max;
}

function validSnapshot(value: unknown): value is ReportSnapshot {
  if (!object(value) || !object(value.document)) return false;
  const { stageId, result, document } = value;
  return (
    typeof stageId === 'number' &&
    Number.isInteger(stageId) &&
    stageId >= 1 &&
    stageId <= 50 &&
    (result === 'victory' || result === 'defeat') &&
    document.fileName === `ming-defense-report-stage-${stageId}-${result}.md` &&
    typeof document.text === 'string' &&
    document.text.trim().length > 0 &&
    withinBytes(document.text, 64 * 1024)
  );
}

function validTime(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 8640000000000000
  );
}

function validEntry(value: unknown): value is CollectedReport {
  return (
    object(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    validTime(value.createdAt) &&
    validSnapshot(value)
  );
}

function cleanEntry(entry: CollectedReport): CollectedReport {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    stageId: entry.stageId,
    result: entry.result,
    document: { fileName: entry.document.fileName, text: entry.document.text },
  };
}

export function reportSnapshot(session: Session, isolated: boolean): ReportSnapshot | null {
  const document = battleReportDocument(session, isolated);
  if (!document || !session.battle?.result) return null;
  return { stageId: session.battle.stageId, result: session.battle.result, document };
}

export function readReports(storage: StoragePort): ReportLibrary {
  try {
    const raw = storage.getItem(REPORT_COLLECTION_KEY);
    if (raw === null) return { entries: [], error: null };
    if (!withinBytes(raw, MAX_LIBRARY_BYTES)) throw new Error('size');
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      !Array.isArray(value.entries) ||
      value.entries.length > REPORT_COLLECTION_LIMIT ||
      !value.entries.every(validEntry)
    ) {
      throw new Error('format');
    }
    const entries = value.entries as CollectedReport[];
    if (
      new Set(entries.map((entry) => entry.id)).size !== entries.length ||
      new Set(entries.map((entry) => entry.document.text)).size !== entries.length
    ) {
      throw new Error('duplicates');
    }
    return { entries: entries.map(cleanEntry).sort((a, b) => b.id - a.id), error: null };
  } catch {
    return { entries: [], error: '战报收藏无法读取，原数据已保留；请重试读取。' };
  }
}

function writeReports(
  storage: StoragePort,
  current: ReportLibrary,
  entries: CollectedReport[],
): ReportLibrary {
  try {
    const raw = JSON.stringify({ schemaVersion: 1, entries });
    if (!withinBytes(raw, MAX_LIBRARY_BYTES)) throw new Error('size');
    storage.setItem(REPORT_COLLECTION_KEY, raw);
    return { entries: entries.map(cleanEntry), error: null };
  } catch {
    return { ...current, error: '保存失败，原收藏未替换；请检查浏览器存储空间后重试。' };
  }
}

export function addReport(
  storage: StoragePort,
  snapshot: ReportSnapshot,
  now = Date.now(),
): AddResult {
  const current = readReports(storage);
  if (current.error) return current;
  if (!validSnapshot(snapshot) || !validTime(now))
    return { ...current, error: '战报数据无效，未收藏。' };
  if (current.entries.some((entry) => entry.document.text === snapshot.document.text)) {
    return { ...current, duplicate: true };
  }
  if (current.entries.length >= REPORT_COLLECTION_LIMIT) {
    return { ...current, error: '10个收藏位已满，请打开战报收藏，删除不需要的记录后再试。' };
  }
  const id = Math.max(1, now, ...current.entries.map((entry) => entry.id + 1));
  if (!Number.isSafeInteger(id)) return { ...current, error: '收藏编号无效，未保存。' };
  const entry = cleanEntry({ ...snapshot, id, createdAt: now });
  return writeReports(storage, current, [entry, ...current.entries]);
}

export function removeReport(storage: StoragePort, id: number): ReportLibrary {
  const current = readReports(storage);
  if (current.error) return current;
  if (!current.entries.some((entry) => entry.id === id)) {
    return { ...current, error: '这份收藏已不存在，请重新读取列表。' };
  }
  return writeReports(
    storage,
    current,
    current.entries.filter((entry) => entry.id !== id),
  );
}

/** An isolated game owns this port; no browser storage is consulted. */
export function temporaryReportStorage(): StoragePort {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}
