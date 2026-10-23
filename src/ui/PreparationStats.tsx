import { useState } from 'react';
import { appearances, heroes } from '../game/content';
import type { Preparation } from '../game/session';
import { preparationStats } from './preparation-stats';
import './preparation-stats.css';

type Props = { preparation: Preparation; unitId: number };

export function PreparationStats({ preparation, unitId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const model = expanded ? preparationStats(preparation, unitId) : null;
  return (
    <details
      className="preparation-stats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>当前站位属性</strong>
        <span>含天赋 · 光环</span>
      </summary>
      {model && (
        <div className="preparation-stats-content">
          <table>
            <caption>
              {appearances[model.kind].name} · {model.rank}阶 · {model.position.x + 1}列
              {model.position.y + 1}行起
            </caption>
            <thead>
              <tr>
                <th scope="col">属性</th>
                <th scope="col">基础</th>
                <th scope="col">当前站位</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.base}</td>
                  <td>{row.current}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {model.kind === 'fortune_peach' && (
            <p>仅在战斗中存活时产钱。产钱间隔不受攻速、聚灵或攻击光环影响。</p>
          )}
          {model.kind === 'shield_fox' && (
            <p>
              施盾比例以目标生命上限计算，实际盾量向下取整，受叠盾上限限制。攻击和攻击光环不提高盾量。
              {model.rank >= heroes.shield_fox.skills.auraFromRank! &&
                `此狐向${heroes.shield_fox.skills.auraRadiusCells}格内伙伴提供攻击光环。`}
            </p>
          )}
          {model.kind !== 'fortune_peach' && model.kind !== 'shield_fox' && (
            <>
              <p className="preparation-stats-aura">
                {model.auraSources.length > 0
                  ? `攻击光环 +${heroes.shield_fox.skills.auraAttackPercent}%（多个不叠加）`
                  : '当前未受攻击光环覆盖。'}
              </p>
              {model.auraSources.length > 0 && (
                <ul aria-label="攻击光环来源">
                  {model.auraSources.map((unit) => (
                    <li key={unit.id}>
                      月音狐{unit.rank}阶 · {unit.position.x + 1}列{unit.position.y + 1}行
                    </li>
                  ))}
                </ul>
              )}
              <p>
                基础命中值含攻击天赋和光环；未计敌方减伤、易伤、残血增伤或技能追加。实际命中再取整，不是每秒伤害。
              </p>
            </>
          )}
          {model.kind !== 'fortune_peach' && (
            <p>动作间隔按游戏步长取整；聚灵需有灵气并持续按住，不代表首次命中时间。</p>
          )}
          <p>基础列不含天赋和光环；当前列按现有布阵计算，移动或撤销后更新。</p>
        </div>
      )}
    </details>
  );
}
