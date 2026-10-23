import { useRef, useState } from 'react';
import { stageNames } from '../game/content';
import type { StoragePort } from '../game/persistence';
import { readReports, removeReport, REPORT_COLLECTION_LIMIT } from './report-collection';
import { ReportText } from './ReportText';
import { ReportCollectionBackup } from './ReportCollectionBackup';
import './report-collection.css';

export function ReportCollection({
  storage,
  isolated,
  onClose,
}: {
  storage: StoragePort;
  isolated: boolean;
  onClose: () => void;
}) {
  const [library, setLibrary] = useState(() => readReports(storage));
  const [selectedId, setSelectedId] = useState(library.entries[0]?.id);
  const [removing, setRemoving] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [backupRevision, setBackupRevision] = useState(0);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const selected = library.entries.find((entry) => entry.id === selectedId) ?? library.entries[0];
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal report-collection"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-collection-title"
      >
        <div className="collection-heading">
          <div>
            <span className="eyebrow">灵林行记 · 手动收藏</span>
            <h2 id="report-collection-title">战报收藏</h2>
          </div>
          <button className="icon-button" aria-label="关闭战报收藏" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="collection-note">
          {library.error
            ? '收藏暂不可用，请重新读取。'
            : `已用 ${library.entries.length}/${REPORT_COLLECTION_LIMIT} 个收藏位，满后不会自动删除。`}
          仅供复盘，不能恢复进度。
        </p>
        <p className="collection-note">
          {isolated
            ? '开发试玩：收藏仅本页临时保留，刷新清空，不读取或写入正式收藏。'
            : '保存在当前浏览器地址，新局仍保留；不包含在战役备份中。重要战报请另行下载。'}
        </p>
        {library.error && <p role="alert">{library.error}</p>}
        <button
          ref={reloadButton}
          className="secondary"
          onClick={() => {
            setLibrary(readReports(storage));
            setRemoving(null);
            setNotice('');
            setBackupRevision((value) => value + 1);
          }}
        >
          重新读取收藏
        </button>
        {!library.error &&
          (selected ? (
            <>
              <label className="collection-select">
                选择收藏战报
                <select
                  aria-label="选择收藏战报"
                  value={selected.id}
                  onChange={(event) => {
                    setSelectedId(Number(event.target.value));
                    setRemoving(null);
                    setNotice('');
                  }}
                >
                  {library.entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      第{entry.stageId}关 · {entry.result === 'victory' ? '胜利' : '失败'} ·{' '}
                      {new Date(entry.createdAt).toLocaleString('zh-CN')}
                    </option>
                  ))}
                </select>
              </label>
              <h3>
                第{selected.stageId}关 · {stageNames[selected.stageId - 1]} ·{' '}
                {selected.result === 'victory' ? '胜利' : '失败'}
              </h3>
              <div className="report-export collection-document">
                <ReportText key={selected.id} report={selected.document} label="收藏战报文本" />
              </div>
              {removing === selected.id ? (
                <div className="collection-confirm" role="group" aria-label="删除收藏确认">
                  <p>
                    删除第{selected.stageId}关这份收藏？删除后无法从收藏中找回，已下载的文件保留。
                  </p>
                  <div className="report-export-actions">
                    <button
                      autoFocus
                      className="secondary"
                      onClick={() => {
                        reloadButton.current?.focus();
                        setRemoving(null);
                      }}
                    >
                      取消删除
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        const result = removeReport(storage, selected.id);
                        reloadButton.current?.focus();
                        setLibrary(result);
                        setRemoving(null);
                        setNotice(result.error ?? '这份收藏已删除。');
                      }}
                    >
                      确认删除收藏
                    </button>
                  </div>
                </div>
              ) : (
                <button className="text-button" onClick={() => setRemoving(selected.id)}>
                  删除这份收藏
                </button>
              )}
            </>
          ) : (
            <p role="status">
              还没有收藏战报。战斗结算后展开「保存本次战报」，点击「收藏到本地」。
            </p>
          ))}
        {notice && <p role="status">{notice}</p>}
        {!library.error && removing === null && (
          <ReportCollectionBackup
            key={backupRevision}
            storage={storage}
            isolated={isolated}
            onImported={(result) => {
              setLibrary(result);
              setNotice('');
            }}
          />
        )}
        <button className="primary" onClick={onClose}>
          返回游戏
        </button>
      </section>
    </div>
  );
}
