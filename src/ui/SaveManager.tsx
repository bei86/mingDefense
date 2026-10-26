import { useEffect, useRef, useState } from 'react';
import type { Session } from '../game/session';
import {
  createBackup,
  inspectBackup,
  readPreviousBackup,
  replaceSavedProgress,
  type BackupPreview,
} from '../game/save-transfer';
import { browserStorage } from './useSessionStorage';
import { readBackupFile } from './backup-file';
import { TextExport } from './TextExport';

type Props = {
  session: Session;
  isolated: boolean;
  onClose: () => void;
  onRestore: (session: Session) => void;
};

export function SaveManager({ session, isolated, onClose, onRestore }: Props) {
  const [exportText, setExportText] = useState('');
  const [exportVersion, setExportVersion] = useState(0);
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  const readVersion = useRef(0);
  useEffect(
    () => () => {
      readVersion.current++;
    },
    [],
  );

  const generated = () => {
    if (isolated) return null;
    try {
      const text = createBackup(session);
      setExportText(text);
      setExportVersion((version) => version + 1);
      return text;
    } catch {
      setNotice('当前检查点无法生成有效备份，请保留页面并重试。');
      return null;
    }
  };
  const inspect = (text: string) => {
    const result = inspectBackup(text);
    setPreview(result.ok ? result.preview : null);
    setNotice(result.ok ? '校验通过。请核对下方进度，确认后才会替换。' : result.error);
  };
  const editText = (text: string) => {
    readVersion.current++;
    setReading(false);
    setImportText(text);
    setPreview(null);
    setNotice('');
  };
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal save-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-manager-title"
      >
        <div className="save-manager-heading">
          <div>
            <span className="eyebrow">灵林行记</span>
            <h2 id="save-manager-title">存档备份与恢复</h2>
          </div>
          <button className="icon-button" aria-label="关闭存档管理" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          当前第{session.preparation.stageId}关 · 修行Lv.{session.preparation.progression.level} ·
          灵钱{session.preparation.currency}
        </p>
        {isolated ? (
          <p role="status">开发试玩不支持备份或恢复正式进度。请打开正常游戏地址操作。</p>
        ) : (
          <>
            <p className="save-manager-note">
              备份可带到另一浏览器或手机恢复，只包含本轮战役。
              战斗中备份会回到开战前，本关临时收益不保留。
            </p>
            <section className="save-manager-section" aria-label="备份当前进度">
              <h3>备份当前进度</h3>
              <div className="save-manager-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    if (generated()) setNotice('备份文本已生成，可复制或手动全选保存。');
                  }}
                >
                  生成备份文本
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    const text = generated();
                    if (!text) return;
                    try {
                      const url = URL.createObjectURL(
                        new Blob([text], { type: 'application/json' }),
                      );
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `ming-defense-stage-${session.preparation.stageId}-${Date.now()}.json`;
                      document.body.append(link);
                      link.click();
                      link.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      setNotice('已发起备份下载，请检查浏览器下载记录；也可复制下方文本。');
                    } catch {
                      setNotice('下载不可用，请复制下方完整备份文本保存。');
                    }
                  }}
                >
                  下载备份文件
                </button>
              </div>
              {exportText && (
                <TextExport
                  key={exportVersion}
                  text={exportText}
                  label="完整备份文本（可手动全选复制）"
                  copyLabel="复制完整备份"
                  copiedNotice="已复制完整备份文本，请妥善保存。"
                />
              )}
            </section>
            <section className="save-manager-section" aria-label="恢复备份">
              <h3>恢复备份</h3>
              <label htmlFor="save-file">选择备份文件（JSON，最大1MiB）</label>
              <input
                id="save-file"
                type="file"
                accept=".json,application/json,text/plain"
                onChange={async (e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  const version = ++readVersion.current;
                  setPreview(null);
                  setImportText('');
                  setNotice('');
                  setReading(true);
                  const { text, inspection } = await readBackupFile(file);
                  if (version !== readVersion.current) return;
                  setImportText(text);
                  setPreview(inspection.ok ? inspection.preview : null);
                  setNotice(
                    inspection.ok ? '校验通过。请核对下方进度，确认后才会替换。' : inspection.error,
                  );
                  setReading(false);
                }}
              />
              <label htmlFor="save-import">或粘贴完整存档文本</label>
              <textarea
                id="save-import"
                value={importText}
                spellCheck={false}
                placeholder="在这里粘贴备份JSON，校验不会改变当前进度"
                onChange={(e) => editText(e.target.value)}
              />
              <div className="save-manager-actions">
                <button
                  className="secondary"
                  disabled={reading || !importText.trim()}
                  onClick={() => inspect(importText)}
                >
                  校验并预览
                </button>
                <button
                  className="secondary"
                  disabled={reading}
                  onClick={() => {
                    readVersion.current++;
                    setImportText('');
                    const previous = readPreviousBackup(browserStorage);
                    setPreview(previous.ok ? previous.preview : null);
                    setNotice(previous.ok ? '已读取上次替换前进度，确认后恢复。' : previous.error);
                  }}
                >
                  读取替换前备份
                </button>
              </div>
            </section>
            {reading && <p role="status">正在读取文件…</p>}
            {notice && (
              <p className="save-manager-notice" role="status">
                {notice}
              </p>
            )}
            {preview && (
              <section className="save-preview" aria-label="待导入进度预览">
                <h3>
                  待导入：第{preview.stage}关 · {preview.state}
                </h3>
                <p>
                  {preview.save.mode === 'campaign' ? '五十关战役' : '首战练习'} · 修行Lv.
                  {preview.level} · 灵钱{preview.currency} · 灵兽{preview.units}只
                </p>
                {preview.migrated && <p>旧版存档可兼容，恢复后采用当前规则，原奖励不重复发放。</p>}
                <p>
                  将替换当前第{session.preparation.stageId}
                  关进度。仅保留最近一次替换前备份，可通过上方入口恢复。
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    const result = replaceSavedProgress(browserStorage, session, preview.save);
                    if (result.ok) onRestore(result.session);
                    else setNotice(result.error);
                  }}
                >
                  确认替换当前进度
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setPreview(null);
                    setNotice('已取消导入，当前进度未改变。');
                  }}
                >
                  取消导入
                </button>
              </section>
            )}
          </>
        )}
        <button className="secondary save-manager-close" onClick={onClose}>
          返回游戏
        </button>
      </section>
    </div>
  );
}
