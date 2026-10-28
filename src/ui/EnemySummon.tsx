import { useState } from 'react';
import type { EnemySummonModel } from './enemy-summon';
import { enemySeconds } from './enemy-inspection';
import './inspection-links.css';

export function EnemySummonContent({ model }: { model: EnemySummonModel }) {
  const frozen = model.frozenMs > 0;
  let timer = frozen ? '待解冻' : '待判定';
  if (model.remainingMs === null) timer = '召唤计时未记录';
  else if (model.remainingMs > 0) timer = `剩余 ${enemySeconds(model.remainingMs)} 秒`;
  return (
    <div className="inspection-threats-content">
      {model.enabled ? (
        <>
          <p>
            {frozen ? '解冻后召唤计时：' : '下次召唤判定：'}
            <strong>{timer}</strong>
          </p>
          {frozen && (
            <p>
              冻结剩余 <strong>{enemySeconds(model.frozenMs)} 秒</strong>，召唤计时解冻后继续。
            </p>
          )}
        </>
      ) : (
        <p>
          {model.phaseRecorded
            ? `尚未启用 · 进入第二阶段后启用召唤（生命阈值${model.triggerHpPercent}%）。`
            : '阶段未记录，无法确认是否已启用召唤；不按当前生命推测。'}
        </p>
      )}
      <p>
        召唤物存活{' '}
        <strong>
          {model.living} / {model.cap}
        </strong>{' '}
        只
      </p>
      <p>
        单次召唤参数 <strong>{model.count} 只咒影</strong> · 后续间隔{' '}
        <strong>{enemySeconds(model.intervalMs)} 秒</strong>
      </p>
      {model.enabled && !model.phaseRecorded && <p>阶段未记录，单次数量按未强化参数显示。</p>}
      <p>仅统计此来源直属存活咒影，不含其他来源或分裂碎片。</p>
      {model.living > 0 && <p>逐只查看见上方“直属存活衍生”。</p>}
      <p>到点按空位结算，实际数量可能少于单次参数；满额时本次可能不生成，之后仍按周期再判定。</p>
      <p>以上为游戏内时间，暂停期间不流逝。继续守卫后阶段、冻结和存活数量可能变化。</p>
    </div>
  );
}

export function EnemySummon({ model }: { model: EnemySummonModel | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!model) return null;
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>当前召唤状态</summary>
      {expanded && <EnemySummonContent model={model} />}
    </details>
  );
}
