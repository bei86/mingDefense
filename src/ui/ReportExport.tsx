import { useState } from 'react';
import type { Session } from '../game/session';
import type { StoragePort } from '../game/persistence';
import { battleReportDocument } from './battle-report-export';
import { addReport, reportSnapshot } from './report-collection';
import { ReportText } from './ReportText';
import './report-export.css';

export function ReportExport({
  session,
  isolated,
  storage,
}: {
  session: Session;
  isolated: boolean;
  storage: StoragePort;
}) {
  const [expanded, setExpanded] = useState(false);
  const report = expanded ? battleReportDocument(session, isolated) : null;
  return (
    <details
      className="report-export"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        保存本次战报 <span>收藏 · 复制 · 下载</span>
      </summary>
      {expanded && (
        <div className="report-export-content">
          {report ? (
            <>
              <p>
                保存阵容、站位、逐兽表现与天赋，方便复盘。战报不能恢复进度；可收藏到本地或自行下载。
              </p>
              <ReportText
                report={report}
                label="本场战报文本"
                onCollect={() => {
                  const snapshot = reportSnapshot(session, isolated);
                  if (!snapshot) return '请先完成本关结算与天赋选择。';
                  const result = addReport(storage, snapshot);
                  if (result.error) return result.error;
                  if (result.duplicate) return '这份战报已经收藏，未占用新的收藏位。';
                  return isolated
                    ? '已加入临时收藏，开发试玩刷新后清空。'
                    : '已收藏，可从「战报收藏」重新查看。';
                }}
              />
            </>
          ) : (
            <p role="status">请先完成本关战斗、结算与天赋选择，再保存战报。</p>
          )}
        </div>
      )}
    </details>
  );
}
