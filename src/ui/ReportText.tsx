import type { BattleReportDocument } from './battle-report-export';
import { TextExport } from './TextExport';
import { downloadText } from './text-download';

type ReportTextProps = {
  report: BattleReportDocument;
  label: string;
  onCollect?: () => string;
};

export function ReportText({ report, label, onCollect }: ReportTextProps) {
  return (
    <TextExport
      text={report.text}
      label={label + '（可手动全选复制）'}
      copyLabel="复制战报"
      copiedNotice="战报已复制。"
      onCollect={onCollect}
      download={{
        label: '下载 Markdown',
        run: () => {
          try {
            downloadText(report.text, report.fileName, 'text/markdown;charset=utf-8');
            return '已发起战报下载，请检查浏览器下载记录；也可复制下方文本。';
          } catch {
            return '下载不可用，请复制下方战报文本保存。';
          }
        },
      }}
    />
  );
}
