import { useState } from 'react';
import { appearances, heroes } from '../game/content';
import type { Combat } from '../game/combat';
import { battleStats } from './battle-stats';
import { BattleAction } from './BattleAction';
import { AuraSources } from './AuraSources';
import { AuraCoverage } from './AuraCoverage';
import './battle-stats.css';

type Props = { battle: Combat | null; unitId: number; onSource: (id: number) => void };

export function BattleStats({ battle, unitId, onSource }: Props) {
  const [expanded, setExpanded] = useState(false);
  const model = expanded ? battleStats(battle, unitId) : null;
  return (
    <details
      className="battle-stats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>战斗当前属性</strong>
        <span>含天赋 · 光环 · 行动状态</span>
      </summary>
      {model && (
        <div className="battle-stats-content">
          {model.alive ? (
            <>
              <table>
                <caption>
                  {appearances[model.kind].name} · {model.rank}阶 · {model.position.x + 1}列
                  {model.position.y + 1}行起
                </caption>
                <thead>
                  <tr>
                    <th scope="col">属性</th>
                    <th scope="col">当前战斗</th>
                  </tr>
                </thead>
                <tbody>
                  {model.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <BattleAction battle={battle} unitId={unitId} />
              {model.kind === 'fortune_peach' && (
                <p>仅在存活时产钱。产钱间隔不受攻速、聚灵或攻击光环影响。</p>
              )}
              {model.kind === 'shield_fox' && (
                <p>
                  施盾比例以目标生命上限计算，实际盾量向下取整，受叠盾上限限制。攻击和攻击光环不提高盾量。
                  {model.rank >= heroes.shield_fox.skills.auraFromRank! &&
                    `此狐向${heroes.shield_fox.skills.auraRadiusCells}格内伙伴提供攻击光环，倒下后失效。`}
                </p>
              )}
              {model.kind !== 'fortune_peach' && model.kind !== 'shield_fox' && (
                <>
                  <p>
                    {model.auraSources.length > 0
                      ? `攻击光环 +${heroes.shield_fox.skills.auraAttackPercent}%（多个不叠加）`
                      : '当前未受存活狐的攻击光环覆盖。'}
                  </p>
                  <AuraSources sources={model.auraSources} onSelect={onSource} />
                  <p>
                    基础命中值含当前攻击天赋和光环；未计敌方减伤、易伤、残血增伤或技能追加。实际命中再取整，不是每秒伤害。
                  </p>
                </>
              )}
              {model.kind !== 'fortune_peach' && (
                <p>
                  动作间隔按游戏步长取整，不代表下一次命中时间。聚灵间隔仅供参考，恢复后需有灵气并持续按住聚灵。
                </p>
              )}
              <p>按暂停时的真实战况计算，继续守卫后天赋和光环可能变化。</p>
            </>
          ) : (
            <p>此灵兽已倒下，本关不再行动；不显示当前攻击、施盾或产钱参数。</p>
          )}
          <AuraCoverage model={model} onSelect={onSource} />
        </div>
      )}
    </details>
  );
}
