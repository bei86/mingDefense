import { useEffect, useId, useRef, useState } from 'react';
import type { StoragePort } from '../game/persistence';
import type { ReportLibrary } from './report-collection';
import {
  createReportBackup,
  planReportImport,
  importReportBackup,
  readReportBackupFile,
  REPORT_BACKUP_FILE_NAME,
  type ReportImportPlan,
} from './report-backup';
import { downloadText } from './text-download';
import { TextExport } from './TextExport';
import './report-backup.css';

type Props = {
  storage: StoragePort;
  isolated: boolean;
  onImported: (library: ReportLibrary) => void;
};

function BackupContent({ storage, isolated, onImported }: Props) {
  const id = useId();
  const [exportText, setExportText] = useState('');
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<Extract<ReportImportPlan, { ok: true }> | null>(null);
  const [notice, setNotice] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  return (
    <div className="report-backup-content">
      <p>
        仅迁移收藏战报，不含战役进度或阵型。导入将保留原收藏并跳过全文重复项，最多10份；超限整批不导入。
      </p>
      <button
        className="secondary"
        onClick={() => {
          const result = createReportBackup(storage);
          setExportText(result.ok ? result.text : '');
          setExportNotice(
            result.ok ? `已生成${result.count}份收藏备份，可复制或下载。` : result.error,
          );
        }}
      >
        生成收藏备份
      </button>
      {exportText && (
        <TextExport
          text={exportText}
          label="完整收藏备份（可手动全选复制）"
          copyLabel="复制收藏备份"
          copiedNotice="收藏备份已复制。"
          download={{
            label: '下载收藏JSON',
            run: () => {
              try {
                downloadText(exportText, REPORT_BACKUP_FILE_NAME, 'application/json;charset=utf-8');
                return '已发起JSON备份下载，请检查浏览器下载记录。';
              } catch {
                return '下载不可用，请复制上方完整备份文本。';
              }
            },
          }}
        />
      )}
      {exportNotice && <p role="status">{exportNotice}</p>}
      <label htmlFor={`${id}-file`}>选择收藏备份文件（JSON，最大1MiB）</label>
      <input
        id={`${id}-file`}
        type="file"
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          const token = ++request.current;
          setPreview(null);
          setNotice('');
          if (!file) {
            setReading(false);
            return;
          }
          setInput('');
          setReading(true);
          const result = await readReportBackupFile(file);
          if (token !== request.current) return;
          setReading(false);
          setInput(result.ok ? result.text : '');
          setNotice(result.ok ? '文件已读取，点击“校验收藏备份”预览合并结果。' : result.error);
        }}
      />
      <label htmlFor={`${id}-import`}>或粘贴完整收藏备份（最大1MiB）</label>
      <textarea
        id={`${id}-import`}
        ref={inputRef}
        value={input}
        spellCheck={false}
        placeholder="粘贴后先校验，确认前不会保存"
        onChange={(event) => {
          request.current++;
          setReading(false);
          setInput(event.target.value);
          setPreview(null);
          setNotice('');
        }}
      />
      {reading && <p role="status">正在读取文件…</p>}
      <button
        className="secondary"
        disabled={reading || !input.trim()}
        onClick={() => {
          const result = planReportImport(storage, input);
          setPreview(result.ok ? result : null);
          setNotice(result.ok ? '校验通过，请核对新增战报，确认后才会保存。' : result.error);
        }}
      >
        校验收藏备份
      </button>
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <section className="report-backup-preview" aria-label="收藏导入预览">
          <h3>
            新增{preview.additions.length}份 · 重复跳过{preview.duplicates}份
          </h3>
          <p>
            合并后共{preview.entries.length}/10份。保留原收藏时间，为新增记录分配本地编号。
            {isolated && '仅本次试玩，刷新清空。'}
          </p>
          {preview.additions.map((entry) => (
            <details key={entry.id}>
              <summary>
                第{entry.stageId}关 · {entry.result === 'victory' ? '胜利' : '失败'} ·{' '}
                {new Date(entry.createdAt).toLocaleString('zh-CN')}
              </summary>
              <label htmlFor={`${id}-report-${entry.id}`}>
                待导入战报全文 · 第{entry.stageId}关
              </label>
              <textarea
                id={`${id}-report-${entry.id}`}
                readOnly
                value={entry.document.text}
                spellCheck={false}
              />
            </details>
          ))}
          {!preview.additions.length && <p>没有新增记录，确认不会写入或覆盖收藏。</p>}
          <div className="report-export-actions">
            <button
              className="primary"
              disabled={reading}
              onClick={() => {
                const result = importReportBackup(storage, input, preview.base);
                setPreview(null);
                setNotice(
                  result.error ??
                    `已合并${result.added}份，跳过${result.duplicates}份重复收藏。${isolated ? '仅本次试玩，刷新清空。' : ''}`,
                );
                if (!result.error) {
                  setInput('');
                  setExportText('');
                  setExportNotice('');
                }
                onImported(result.library);
                inputRef.current?.focus();
              }}
            >
              确认合并收藏
            </button>
            <button
              className="secondary"
              onClick={() => {
                setPreview(null);
                setNotice('已取消导入，收藏未改变。');
                inputRef.current?.focus();
              }}
            >
              取消导入收藏
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function ReportCollectionBackup(props: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="report-backup"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>收藏备份 · 导出与导入</summary>
      {expanded && <BackupContent {...props} />}
    </details>
  );
}
