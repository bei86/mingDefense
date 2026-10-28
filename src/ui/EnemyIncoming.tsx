import { useState } from 'react';
import { appearances } from '../game/content';
import type { IncomingAttack } from './incoming-attacks';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

type Props = { actions: IncomingAttack[]; onSelect: (id: number) => void };

export function EnemyIncomingList({ actions, onSelect }: Props) {
  return (
    <div className="inspection-threats-content">
      {actions.length > 0 ? (
        <ul aria-label="准备攻击来源名单">
          {actions.map((action, index) => {
            const { source } = action;
            const name = `${appearances[source.kind].name}${source.rank}阶`;
            const position = `${source.position.x + 1}列${source.position.y + 1}行`;
            return (
              <li key={index}>
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看攻击来源：${name}，编号${source.id}，${position}`}
                  onClick={() => onSelect(source.id)}
                >
                  <span>
                    {name} · #{source.id}
                    <br />
                    {position}起 · 第{action.ordinal}次动作
                  </span>
                  <small>
                    {action.remainingMs > 0
                      ? `剩余 ${enemySeconds(action.remainingMs)} 秒`
                      : '待释放'}{' '}
                    · 查看来源 ›
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>当前没有灵兽准备直接攻击此敌人。</p>
      )}
      <p>
        仅列存活灵兽已准备的直接目标，不含施盾、已发出的攻击、持续效果或范围伤害的其他对象。准备不保证命中，也不预测下一次攻击。
      </p>
      <p>以上为游戏内时间，暂停期间不流逝。点击来源查看对应灵兽，战斗保持暂停。</p>
    </div>
  );
}

export function EnemyIncoming({ actions, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>正准备攻击此敌人 · {actions.length}次</summary>
      {expanded && <EnemyIncomingList actions={actions} onSelect={onSelect} />}
    </details>
  );
}
