import { appearances, heroes } from '../game/content';
import type { BattleStatsModel } from './battle-stats';

type Props = { model: BattleStatsModel; onSelect: (id: number) => void };

export function AuraCoverage({ model, onSelect }: Props) {
  if (model.kind !== 'shield_fox') return null;
  const skill = heroes.shield_fox.skills;
  if (!model.alive) return <p>此狐已倒下，攻击光环已失效。</p>;
  if (model.rank < skill.auraFromRank!) {
    return <p>攻击光环需{skill.auraFromRank}阶解锁，此狐尚未解锁。</p>;
  }
  if (model.auraTargets.length === 0) return <p>当前没有可受攻击加成的存活伙伴。</p>;
  return (
    <details className="battle-aura-coverage">
      <summary>攻击光环覆盖 · {model.auraTargets.length}只</summary>
      <p>
        攻击 +{skill.auraAttackPercent}%（多个不叠加）。仅列存活攻击伙伴，施盾狐与产钱桃不计入。
      </p>
      <ul className="battle-aura-sources" aria-label="此狐的存活攻击光环伙伴">
        {model.auraTargets.map((target) => (
          <li key={target.id}>
            <button
              type="button"
              className="secondary battle-aura-source"
              aria-label={`查看光环伙伴：${appearances[target.kind].name}${target.rank}阶，${target.position.x + 1}列${target.position.y + 1}行，编号${target.id}`}
              onClick={() => onSelect(target.id)}
            >
              <span>
                {appearances[target.kind].name}
                {target.rank}阶 · 编号{target.id}
              </span>
              <small>
                {target.position.x + 1}列{target.position.y + 1}行 · 查看伙伴 ›
              </small>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
