import { appearances } from '../game/content';
import { enemySeconds, type InspectedWarning } from './enemy-inspection';
import type { BossWarningTarget } from './boss-warnings';
import './inspection-links.css';
import './enemy-warnings.css';

type Props = {
  warnings: readonly InspectedWarning[];
  onSelect: (id: number) => void;
  initialWarning?: BossWarningTarget;
};

function preparationTime(warning: InspectedWarning): string {
  if (warning.remainingMs <= 0) return warning.frozenMs > 0 ? '待解冻' : '待释放';
  const label = warning.frozenMs > 0 ? '解冻后准备' : '剩余';
  return `${label} ${enemySeconds(warning.remainingMs)} 秒`;
}

export function EnemyWarnings({ warnings, onSelect, initialWarning }: Props) {
  return (
    <div className="enemy-warnings">
      <h4>已出现的横扫预警</h4>
      {warnings.length > 0 ? (
        <>
          <ul aria-label="已出现的横扫预警">
            {warnings.map((warning, index) => (
              <li className="inspection-warning-entry" key={index}>
                <div className="inspection-warning-heading">
                  <strong>
                    第 {warning.row} 行{warning.echo ? ' · 回响' : ''}
                  </strong>
                  <span>{preparationTime(warning)}</span>
                </div>
                {warning.frozenMs > 0 && (
                  <p className="inspection-warning-note">
                    冻结剩余 {enemySeconds(warning.frozenMs)} 秒 ·
                    释放延后。准备时间在解冻后继续计算。
                  </p>
                )}
                {warning.allies.length > 0 ? (
                  <details
                    className="inspection-warning-allies"
                    open={
                      (initialWarning?.row === warning.row &&
                        initialWarning.echo === warning.echo) ||
                      undefined
                    }
                  >
                    <summary>预警行内 · {warning.allies.length}只灵兽</summary>
                    <ul
                      aria-label={`第${warning.row}行${warning.echo ? '回响' : '横扫'}预警行内灵兽`}
                    >
                      {warning.allies.map((ally) => (
                        <li key={ally.id}>
                          <button
                            type="button"
                            className="secondary inspection-link"
                            aria-label={`查看预警行内灵兽：${appearances[ally.kind].name}${ally.rank}阶，编号${ally.id}，${ally.position.x + 1}列${ally.position.y + 1}行起`}
                            onClick={() => onSelect(ally.id)}
                          >
                            <span>
                              {appearances[ally.kind].name}
                              {ally.rank}阶 · #{ally.id}
                            </span>
                            <small>
                              {ally.position.x + 1}列{ally.position.y + 1}行起 ›
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p>当前该行没有存活灵兽。</p>
                )}
              </li>
            ))}
          </ul>
          <p className="inspection-warning-note">
            名单按当前存活与完整占格列出，跨行灵兽也计入。实际释放时重新判断；冻结可能推迟释放。
          </p>
        </>
      ) : (
        <p>当前没有已记录预警。</p>
      )}
    </div>
  );
}
