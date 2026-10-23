import { useId, useState } from 'react';
import type { BattleReportDocument } from './battle-report-export';
import './report-export.css';

export function ReportText({
  report,
  label,
  onCollect,
}: {
  report: BattleReportDocument;
  label: string;
  onCollect?: () => string;
}) {
  const textId = useId();
  const [notice, setNotice] = useState('');
  const [copying, setCopying] = useState(false);
  return (
    <div className="report-text">
      {onCollect && (
        <button className="secondary collect-report" onClick={() => setNotice(onCollect())}>
          收藏到本地
        </button>
      )}
      <div className="report-export-actions">
        <button
          className="secondary"
          disabled={copying}
          onClick={async () => {
            setCopying(true);
            setNotice('正在复制；也可在下方文本框中手动全选复制。');
            try {
              await navigator.clipboard.writeText(report.text);
              setNotice('战报已复制。');
            } catch {
              setNotice('自动复制不可用，请在下方文本框中全选复制。');
            } finally {
              setCopying(false);
            }
          }}
        >
          {copying ? '正在复制…' : '复制战报'}
        </button>
        <button
          className="secondary"
          onClick={() => {
            try {
              const url = URL.createObjectURL(
                new Blob([report.text], { type: 'text/markdown;charset=utf-8' }),
              );
              try {
                const link = document.createElement('a');
                link.href = url;
                link.download = report.fileName;
                document.body.append(link);
                try {
                  link.click();
                } finally {
                  link.remove();
                }
              } finally {
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }
              setNotice('已发起战报下载，请检查浏览器下载记录；也可复制下方文本。');
            } catch {
              setNotice('下载不可用，请复制下方战报文本保存。');
            }
          }}
        >
          下载 Markdown
        </button>
      </div>
      {notice && (
        <p role="status" className="report-export-notice">
          {notice}
        </p>
      )}
      <label htmlFor={textId}>{label}（可手动全选复制）</label>
      <textarea id={textId} readOnly value={report.text} spellCheck={false} />
    </div>
  );
}
