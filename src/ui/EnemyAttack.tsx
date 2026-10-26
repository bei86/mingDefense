import { useState } from 'react';
import { appearances } from '../game/content';
import type { EnemyAttackModel } from './enemy-attack';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';
import './enemy-attack.css';

type ContentProps = { model: EnemyAttackModel; onTarget: (id: number) => void };

export function EnemyAttackContent({ model, onTarget }: ContentProps) {
  const frozen = model.frozenMs > 0;
  return (
    <div className="enemy-attack-content">
      <p className="enemy-attack-status">{model.status}</p>
      {frozen && (
        <p>
          冻结剩余 <strong>{enemySeconds(model.frozenMs)} 秒</strong>。
          下方冷却和准备时间从解冻后继续计算。
        </p>
      )}
      <p>
        {frozen ? '解冻后普攻冷却：' : '普攻冷却：'}
        <strong>
          {model.cooldownMs > 0 ? `剩余 ${enemySeconds(model.cooldownMs)} 秒` : '已就绪'}
        </strong>
      </p>
      {model.pending.length > 0 ? (
        <ul aria-label="准备中的普攻">
          {model.pending.map((attack, index) => {
            const target = attack.target;
            let remaining = frozen ? '待解冻' : '待释放';
            if (attack.remainingMs > 0) remaining = `剩余 ${enemySeconds(attack.remainingMs)} 秒`;
            return (
              <li key={index}>
                <strong>准备普攻 · {remaining}</strong>
                <span>
                  目标：{target ? `${appearances[target.kind].name}${target.rank}阶` : '未记录'} · #
                  {attack.targetId}
                </span>
                {target && (
                  <span>
                    {target.position.x + 1}列{target.position.y + 1}行起
                  </span>
                )}
                {target && attack.targetAlive ? (
                  <button
                    type="button"
                    className="secondary inspection-link"
                    aria-label={`查看普攻目标：${appearances[target.kind].name}${target.rank}阶，编号${target.id}，${target.position.x + 1}列${target.position.y + 1}行`}
                    onClick={() => onTarget(target.id)}
                  >
                    查看受击灵兽 ›
                  </button>
                ) : (
                  <span className="enemy-attack-lost">目标已倒下或未记录，此次普攻不会生效。</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>当前没有准备中的普攻。</p>
      )}
      <p>准备目标与当前锁定可能不同。冷却结束仍需接近有效目标，不代表下一次命中时间。</p>
      <p>这里只列普攻，横扫请看下方预警。以上为游戏内时间，暂停期间不流逝。</p>
    </div>
  );
}

type Props = { model: EnemyAttackModel | null; onTarget: (id: number) => void };

export function EnemyAttack({ model, onTarget }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!model) return null;
  return (
    <details
      className="enemy-attack inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>当前普攻状态</summary>
      {expanded && <EnemyAttackContent model={model} onTarget={onTarget} />}
    </details>
  );
}
