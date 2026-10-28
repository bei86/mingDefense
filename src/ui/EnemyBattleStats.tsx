import { useState } from 'react';
import type { EnemyBattleStatsModel } from './enemy-battle-stats';
import './battle-stats.css';

function number(value: number): string {
  return String(Number(value.toFixed(4)));
}

export function EnemyBattleStatsContent({ model }: { model: EnemyBattleStatsModel }) {
  const rows = [
    ['本关基础普攻', String(model.baseDamage)],
    ['当前普攻值', String(model.damage)],
    ['普攻动作间隔', `${number(model.intervalMs / 1000)} 秒`],
    ['普攻射程', `${number(model.range)} 格`],
    [model.frozen ? '解冻后接近移速' : '接近时移速', `${number(model.speed)} 格/秒`],
    ['有效移速减幅', `${number(model.slowPercent)}%`],
  ];
  return (
    <div className="battle-stats-content">
      <table>
        <caption>所选敌人 · 暂停时参数</caption>
        <thead>
          <tr>
            <th scope="col">属性</th>
            <th scope="col">当前战斗</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {model.rage && (
        <>
          <p>
            狂暴 {model.rage.stacks} / {model.rage.maxStacks} 层 · 普攻 +{model.rage.percent}
            %。冻结不停止狂暴的存活计时。
          </p>
          {!model.rage.birthRecorded && <p>出生时间未记录，狂暴沿用当前引擎的战斗计时。</p>}
        </>
      )}
      {model.kind === 'boss' && (
        <p>
          {model.phaseRecorded
            ? `当前阶段攻速加成 +${model.phase2SpeedPercent}%，已计入动作间隔。`
            : '阶段未记录，动作间隔沿用当前引擎未加速计算；不按残血推测阶段。'}
        </p>
      )}
      {model.frozen && <p>冻结中，移动和普攻暂停；上表移速为解冻后的接近参数。</p>}
      <p>移速减幅合并霜尾缓行与迟滞并受上限约束；接近时移速不代表正在移动。</p>
      <p>当前普攻值含本关倍率与当前狂暴，未扣目标护盾，不含横扫。实际释放时重新计算。</p>
      <p>
        动作间隔按游戏步长取整，不代表下一次命中时间；已有冷却和准备动作见“当前普攻状态”。继续守卫后参数可能改变。
      </p>
    </div>
  );
}

export function EnemyBattleStats({ model }: { model: EnemyBattleStatsModel | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!model) return null;
  return (
    <details
      className="battle-stats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>当前战斗属性</strong>
        <span>普攻 · 间隔 · 移速</span>
      </summary>
      {expanded && <EnemyBattleStatsContent model={model} />}
    </details>
  );
}
