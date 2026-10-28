import { useState } from 'react';
import type { AllyWarning } from './ally-warnings';
import type { BossWarningTarget } from './boss-warnings';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

type Props = { warnings: readonly AllyWarning[]; onSelect: (target: BossWarningTarget) => void };

export function AllyWarningsList({ warnings, onSelect }: Props) {
  return (
    <div className="inspection-threats-content">
      {warnings.length > 0 ? (
        <ul aria-label="波及此灵兽的横扫预警名单">
          {warnings.map((warning, index) => {
            const frozen = warning.frozenMs > 0;
            let remaining = frozen ? '待解冻' : '待释放';
            if (warning.remainingMs > 0) {
              remaining = `${frozen ? '解冻后准备' : '准备剩余'} ${enemySeconds(warning.remainingMs)} 秒`;
            }
            const segment = warning.echo ? '回响' : '横扫';
            return (
              <li key={index}>
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看横扫预警：${warning.source.name}，编号${warning.source.id}，第${warning.row}行，${segment}`}
                  onClick={() =>
                    onSelect({ source: warning.source.id, row: warning.row, echo: warning.echo })
                  }
                >
                  <span>
                    {warning.source.name} · #{warning.source.id}
                    <br />第{warning.row}行 · {segment}
                    {frozen && (
                      <>
                        <br />
                        冻结剩余 {enemySeconds(warning.frozenMs)} 秒
                      </>
                    )}
                  </span>
                  <small>{remaining} · 查看预警 ›</small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>当前没有已生成横扫预警波及此灵兽。</p>
      )}
      <p>按当前存活与完整占格列出，实际释放时重新判断，不预测伤害或倒下结果。</p>
      <p>按来源编号、行号与段次排列，不代表释放顺序。冻结会延后释放；以上为游戏内时间。</p>
    </div>
  );
}

export function AllyWarnings({ warnings, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>波及此灵兽的横扫预警 · {warnings.length}道</summary>
      {expanded && <AllyWarningsList warnings={warnings} onSelect={onSelect} />}
    </details>
  );
}
