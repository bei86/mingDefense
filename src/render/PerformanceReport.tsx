import { useState } from 'react';
import { TextExport } from '../ui/TextExport';
import { downloadText } from '../ui/text-download';
import {
  performanceReport,
  type PerformanceDocument,
  type PerformanceSample,
} from './performance-report';
import './performance-report.css';

type Props = { readSample: () => PerformanceSample | null; onReset: () => void };

export function PerformanceReport({ readSample, onReset }: Props) {
  const [report, setReport] = useState<PerformanceDocument | null>(null);
  const [notice, setNotice] = useState('');
  const [captureVersion, setCaptureVersion] = useState(0);
  return (
    <div className="performance-report">
      <p>在手机前台保持游玩后捕获。只保存最近采样窗口，不代表整局性能。</p>
      <div className="performance-actions">
        <button
          className="secondary"
          onClick={() => {
            const sample = readSample();
            setCaptureVersion((version) => version + 1);
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
          <TextExport
            key={captureVersion}
            text={report.text}
            label="已捕获诊断文本（固定快照，可手动全选复制）"
            copyLabel="复制诊断报告"
            copiedNotice="诊断报告已复制。"
            download={{
              label: '下载诊断报告',
              run: () => {
                try {
                  downloadText(report.text, report.fileName, 'text/markdown;charset=utf-8');
                  return '已发起诊断报告下载，请检查浏览器下载记录；也可手动复制下方文本。';
                } catch {
                  return '下载不可用，请手动复制下方诊断文本。';
                }
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
