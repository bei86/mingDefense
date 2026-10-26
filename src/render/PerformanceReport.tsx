import { useId, useState } from 'react';
import { downloadText } from '../ui/text-download';
import {
  performanceReport,
  type PerformanceDocument,
  type PerformanceSample,
} from './performance-report';
import './performance-report.css';

type Props = { readSample: () => PerformanceSample | null; onReset: () => void };

export function PerformanceReport({ readSample, onReset }: Props) {
  const textId = useId();
  const [report, setReport] = useState<PerformanceDocument | null>(null);
  const [notice, setNotice] = useState('');
  const [copying, setCopying] = useState(false);
  return (
    <div className="performance-report">
      <p>在手机前台保持游玩后捕获。只保存最近采样窗口，不代表整局性能。</p>
      <div className="performance-actions">
        <button
          className="secondary"
          disabled={copying}
          onClick={() => {
            const sample = readSample();
            setReport(sample ? performanceReport(sample, navigator.userAgent) : null);
            setNotice(
              sample
                ? '已捕获固定快照，后续帧不会修改下方报告。'
                : '暂无当前状态的样本，请保持页面在前台，等待采样后重试。',
            );
          }}
        >
          捕获诊断报告
        </button>
        <button
          className="secondary"
          onClick={() => {
            onReset();
            setNotice('已重新采样；已有报告保留为旧快照，再次捕获才会替换。');
          }}
        >
          重新采样
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {report && (
        <div className="performance-captured">
          <div className="performance-actions">
            <button
              className="secondary"
              disabled={copying}
              onClick={async () => {
                setCopying(true);
                try {
                  await navigator.clipboard.writeText(report.text);
                  setNotice('诊断报告已复制。');
                } catch {
                  setNotice('自动复制不可用，请在下方文本框中全选复制，或下载报告。');
                } finally {
                  setCopying(false);
                }
              }}
            >
              {copying ? '正在复制…' : '复制诊断报告'}
            </button>
            <button
              className="secondary"
              onClick={() => {
                try {
                  downloadText(report.text, report.fileName, 'text/markdown;charset=utf-8');
                  setNotice('已发起诊断报告下载，请检查浏览器下载记录；也可手动复制下方文本。');
                } catch {
                  setNotice('下载不可用，请手动复制下方诊断文本。');
                }
              }}
            >
              下载诊断报告
            </button>
          </div>
          <label htmlFor={textId}>已捕获诊断文本（固定快照，可手动全选复制）</label>
          <textarea id={textId} readOnly value={report.text} spellCheck={false} />
        </div>
      )}
    </div>
  );
}
