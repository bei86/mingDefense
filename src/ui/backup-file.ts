import { inspectBackup, MAX_BACKUP_BYTES, type BackupInspection } from '../game/save-transfer';

export async function readBackupFile(
  file: Pick<File, 'size' | 'text'>,
): Promise<{ text: string; inspection: BackupInspection }> {
  if (file.size > MAX_BACKUP_BYTES)
    return {
      text: '',
      inspection: { ok: false, error: '备份不能超过1MiB，请选择正确的存档文件。' },
    };
  try {
    const text = await file.text();
    return { text, inspection: inspectBackup(text) };
  } catch {
    return { text: '', inspection: { ok: false, error: '文件读取失败，请重新选择或粘贴文本。' } };
  }
}
