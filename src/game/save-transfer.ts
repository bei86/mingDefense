import { stages } from './content';
import { compatibleSave, SAVE_KEY, validSave, type StoragePort } from './persistence';
import { Session, type SessionSave } from './session';

export const MAX_BACKUP_BYTES = 1024 * 1024;
export const PREVIOUS_SAVE_KEY = `${SAVE_KEY}:before-import`;
const FORMAT = 'ming-defense-backup';

export type BackupPreview = {
  save: SessionSave;
  migrated: boolean;
  stage: number;
  state: string;
  level: number;
  currency: number;
  units: number;
};
export type BackupInspection = { ok: true; preview: BackupPreview } | { ok: false; error: string };

function envelope(session: Session, date: Date) {
  const save = session.exportSave();
  if (!validSave(save)) throw new Error('当前检查点无法生成有效备份。');
  return { format: FORMAT, backupVersion: 1, exportedAt: date.toISOString(), save };
}
export function createBackup(session: Session, date = new Date()): string {
  const text = JSON.stringify(envelope(session, date), null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error('当前备份超过1MiB，无法导出。');
  return text;
}
export function inspectBackup(text: string): BackupInspection {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    return { ok: false, error: '备份不能超过1MiB，请选择正确的存档文件。' };
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: '无法识别存档文本，请粘贴完整JSON或选择备份文件。' };
  }
  if (typeof value === 'object' && value !== null && 'format' in value) {
    const backup = value as Record<string, unknown>;
    if (backup.format !== FORMAT || backup.backupVersion !== 1)
      return { ok: false, error: '备份格式或版本不兼容，当前进度未改变。' };
    value = backup.save;
  }
  const save = compatibleSave(value);
  if (!save) return { ok: false, error: '存档已损坏或内容版本不兼容，当前进度未改变。' };
  const complete = save.mode === 'campaign' && save.preparation.stageId === stages.length;
  let state = save.recoveredBattle ? '开战前检查点' : '整备布阵';
  if (save.phase === 'victory') {
    state = '本关已守住';
    if (!save.settled) state = '关后待选天赋';
    else if (complete) state = '五十关已完成';
  }
  return {
    ok: true,
    preview: {
      save,
      migrated:
        typeof value === 'object' &&
        value !== null &&
        'contentVersion' in value &&
        value.contentVersion !== save.contentVersion,
      stage: save.preparation.stageId,
      state,
      level: save.battle?.progression.level ?? save.preparation.progression.level,
      currency: save.preparation.currency,
      units: save.preparation.units.length,
    },
  };
}

export function replaceSavedProgress(
  storage: StoragePort,
  current: Session,
  incoming: SessionSave,
): { ok: true; session: Session } | { ok: false; error: string } {
  if (!validSave(incoming)) return { ok: false, error: '待导入存档无效，请重新校验。' };
  try {
    const restored = Session.restore(incoming);
    const backup = envelope(current, new Date());
    const replacedRaw = storage.getItem(SAVE_KEY);
    storage.setItem(PREVIOUS_SAVE_KEY, JSON.stringify({ ...backup, replacedRaw }));
    storage.setItem(SAVE_KEY, JSON.stringify(incoming));
    return { ok: true, session: restored };
  } catch {
    return { ok: false, error: '无法读取或写入本地存档，未替换当前进度。请先导出备份后重试。' };
  }
}
export function readPreviousBackup(storage: StoragePort): BackupInspection {
  try {
    const text = storage.getItem(PREVIOUS_SAVE_KEY);
    if (!text) return { ok: false, error: '还没有替换前备份。首次成功导入后会保留一份。' };
    // The raw overwritten file is retained for recovery, but is not part of the playable snapshot.
    const backup = JSON.parse(text) as Record<string, unknown>;
    return inspectBackup(
      JSON.stringify({
        format: backup.format,
        backupVersion: backup.backupVersion,
        save: backup.save,
      }),
    );
  } catch {
    return { ok: false, error: '无法读取替换前备份，当前进度未改变。' };
  }
}
