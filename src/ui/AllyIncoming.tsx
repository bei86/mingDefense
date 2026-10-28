import { useState } from 'react';
import type { IncomingEnemyAttack } from './ally-incoming';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

type Props = { actions: readonly IncomingEnemyAttack[]; onSelect: (id: number) => void };

export function AllyIncomingList({ actions, onSelect }: Props) {
  return (
    <div className="inspection-threats-content">
      {actions.length > 0 ? (
        <ul aria-label="准备普攻来源名单">
          {actions.map((action, index) => {
            const frozen = action.frozenMs > 0;
            let remaining = frozen ? '待解冻' : '待释放';
            if (action.remainingMs > 0) {
              remaining = `${frozen ? '解冻后准备' : '准备剩余'} ${enemySeconds(action.remainingMs)} 秒`;
            }
            return (
              <li key={index}>
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看普攻来源：${action.source.name}，编号${action.source.id}`}
                  onClick={() => onSelect(action.source.id)}
                >
                  <span>
                    {action.source.name} · #{action.source.id}
                    {frozen && (
                      <>
                        <br />
                        冻结剩余 {enemySeconds(action.frozenMs)} 秒
                      </>
                    )}
                  </span>
                  <small>{remaining} · 查看敌人 ›</small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>当前没有敌人准备普攻此灵兽。</p>
      )}
      <p>准备目标可能与当前锁定不同，准备不保证命中。这里只列普攻，横扫与回响请看敌人预警。</p>
      <p>按来源编号排列；冻结会推迟释放。以上为游戏内时间，暂停期间不流逝。</p>
    </div>
  );
}

export function AllyIncoming({ actions, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>正准备普攻此灵兽 · {actions.length}次</summary>
      {expanded && <AllyIncomingList actions={actions} onSelect={onSelect} />}
    </details>
  );
}
