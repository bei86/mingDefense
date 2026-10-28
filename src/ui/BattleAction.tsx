import type { Combat } from '../game/combat';
import { battleAction, type BattleActionTarget } from './battle-action';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

type Props = {
  battle: Combat | null;
  unitId: number;
  onTarget: (target: BattleActionTarget) => void;
};

export function BattleAction({ battle, unitId, onTarget }: Props) {
  const model = battleAction(battle, unitId);
  if (!model?.alive) return null;
  const isShield = battle?.allies.find((unit) => unit.id === unitId)?.kind === 'shield_fox';
  const cooldownMs = model.cooldownMs ?? 0;
  return (
    <section className="battle-action" aria-label="当前行动状态">
      <h4>当前行动状态</h4>
      <p className="battle-action-status">{model.status}</p>
      {model.incomeMs !== null ? (
        <p>
          下次产钱：
          <strong>
            {model.incomeMs > 0 ? `剩余 ${enemySeconds(model.incomeMs)} 秒` : '待产钱'}
          </strong>
        </p>
      ) : (
        <>
          <p>
            再次行动最早：
            <strong>{cooldownMs > 0 ? `${enemySeconds(cooldownMs)} 秒后` : '已就绪'}</strong>
          </p>
          {model.pending.length > 0 ? (
            <ul aria-label="准备中的动作">
              {model.pending.map((action, index) => (
                <li key={index}>
                  <strong>
                    {isShield ? '准备施盾' : '准备攻击'} · 第{action.ordinal}次动作
                  </strong>
                  {action.targetAlive ? (
                    <button
                      type="button"
                      className="secondary inspection-link"
                      aria-label={`查看${isShield ? '施盾' : '攻击'}目标：${action.targetLabel}`}
                      onClick={() => onTarget(action.target)}
                    >
                      <span>目标：{action.targetLabel}</span>
                      <small>查看目标 ›</small>
                    </button>
                  ) : (
                    <span>目标：{action.targetLabel}</span>
                  )}
                  <span>
                    {action.remainingMs > 0
                      ? `剩余 ${enemySeconds(action.remainingMs)} 秒`
                      : '待释放'}
                  </span>
                  {!action.targetAlive && (
                    <span className="battle-action-lost">目标已倒下或退场，此动作不会生效。</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>当前没有准备中的动作。</p>
          )}
          <p>
            冷却结束仍需合适目标。准备动作与冷却分别计时，释放不保证命中；已发出的攻击和持续效果不在此列。
          </p>
        </>
      )}
      <p>以上均为游戏内时间，暂停期间不流逝。</p>
    </section>
  );
}
