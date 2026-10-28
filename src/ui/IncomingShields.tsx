import { useState } from 'react';
import { appearances } from '../game/content';
import type { IncomingShield } from './incoming-shields';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

type Props = { actions: readonly IncomingShield[]; onSelect: (id: number) => void };

export function IncomingShieldsList({ actions, onSelect }: Props) {
  return (
    <div className="inspection-threats-content">
      {actions.length > 0 ? (
        <ul aria-label="准备施盾来源名单">
          {actions.map((action, index) => {
            const { source } = action;
            const name = `${appearances[source.kind].name}${source.rank}阶`;
            const position = `${source.position.x + 1}列${source.position.y + 1}行`;
            return (
              <li key={index}>
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看施盾来源：${name}，编号${source.id}，${position}`}
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
        <p>当前没有月音狐准备为此灵兽施盾。</p>
      )}
      <p>
        只列存活月音狐已准备的施盾，不含已有护盾或攻击光环。准备不保证获盾，实际增加量在释放时结算。
      </p>
      <p>以上为游戏内时间，暂停期间不流逝。点击来源查看对应月音狐，战斗保持暂停。</p>
    </div>
  );
}

export function IncomingShields({ actions, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>正准备为此灵兽施盾 · {actions.length}次</summary>
      {expanded && <IncomingShieldsList actions={actions} onSelect={onSelect} />}
    </details>
  );
}
