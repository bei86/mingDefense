import { useState } from 'react';
import type { Session } from '../game/session';
import { battleSnapshotDocument, type BattleSnapshotDocument } from './battle-snapshot';
import { TextExport } from './TextExport';
import { downloadText } from './text-download';
import './report-export.css';

export function BattleSnapshotContent({ document }: { document: BattleSnapshotDocument }) {
  return (
    <div className="report-export-content">
      <p>
        导出全部上阵灵兽、本关累计贡献与合计、存活敌人、双方当前行动与准备、召唤计时与容量、锁定与已有横扫预警，不受筛选影响。只供复盘，不能恢复进度；继续守卫后重新打开可导出新快照。
      </p>
      <TextExport
        text={document.text}
        label="当前战场快照（可手动全选复制）"
        copyLabel="复制战场快照"
        copiedNotice="战场快照已复制。"
        download={{
          label: '下载战场快照',
          run: () => {
            try {
              downloadText(document.text, document.fileName, 'text/markdown;charset=utf-8');
              return '已发起快照下载，请检查浏览器下载记录；也可复制下方文本。';
            } catch {
              return '下载不可用，请复制下方快照文本保存。';
            }
          },
        }}
      />
    </div>
  );
}

export function BattleSnapshot({ session, isolated }: { session: Session; isolated: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const document = expanded ? battleSnapshotDocument(session, isolated) : null;
  return (
    <details
      className="report-export"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>导出当前战场快照</summary>
      {expanded &&
        (document ? (
          <BattleSnapshotContent document={document} />
        ) : (
          <p role="status" className="report-export-content">
            请在无待选天赋的暂停战斗中导出快照。
          </p>
        ))}
    </details>
  );
}
