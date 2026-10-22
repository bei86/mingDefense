import { expect, test, vi } from 'vitest';
import { createBackup, MAX_BACKUP_BYTES } from '../game/save-transfer';
import { Session } from '../game/session';
import { readBackupFile } from './backup-file';

test('文件入口先按size拒绝超限，完全不读取文件内容', async () => {
  const text = vi.fn(async () => 'not read');
  const result = await readBackupFile({ size: MAX_BACKUP_BYTES + 1, text });
  expect(result.inspection).toMatchObject({ ok: false });
  expect(result.text).toBe('');
  expect(text).not.toHaveBeenCalled();
});
test('合法JSON文件与粘贴协议一致，不仅信任扩展名或报告的size', async () => {
  const text = createBackup(new Session());
  const loaded = await readBackupFile({ size: text.length, text: async () => text });
  expect(loaded.text).toBe(text);
  expect(loaded.inspection).toMatchObject({ ok: true, preview: { stage: 1, units: 0 } });
  expect(
    (await readBackupFile({ size: 1, text: async () => '坏'.repeat(MAX_BACKUP_BYTES) })).inspection
      .ok,
  ).toBe(false);
});
test('读取失败与无效JSON都有可恢复错误，不返回可确认候选', async () => {
  expect(
    (
      await readBackupFile({
        size: 10,
        text: async () => {
          throw new Error('missing');
        },
      })
    ).inspection,
  ).toMatchObject({ ok: false, error: '文件读取失败，请重新选择或粘贴文本。' });
  expect((await readBackupFile({ size: 10, text: async () => '{bad' })).inspection.ok).toBe(false);
});
