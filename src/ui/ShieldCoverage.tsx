import { appearances } from '../game/content';
import type { ShieldCoverageModel } from './shield-coverage';

type Props = { model: ShieldCoverageModel | null; onSelect: (id: number) => void };

export function ShieldCoverage({ model, onSelect }: Props) {
  if (!model) return null;
  if (!model.alive) return <p>此狐已倒下，本关不再施盾。</p>;
  return (
    <details className="battle-aura-coverage">
      <summary>施盾可达灵兽 · {model.targets.length}只</summary>
      <p>
        当前施盾射程 {Number(model.range.toFixed(2))} 格，按整体中心距离计算，含射程天赋。
        仅列存活上阵灵兽，包含本狐自身、其他狐和桃；已有护盾仍计入范围可达。
      </p>
      <p>可达不保证下一次获盾；不代表攻击光环覆盖或已准备的施盾动作，实际增加量在释放时结算。</p>
      <ul className="battle-aura-sources" aria-label="此狐的存活施盾可达灵兽">
        {model.targets.map((target) => (
          <li key={target.id}>
            <button
              type="button"
              className="secondary battle-aura-source"
              aria-label={`查看施盾可达灵兽：${appearances[target.kind].name}${target.rank}阶，${target.position.x + 1}列${target.position.y + 1}行，编号${target.id}`}
              onClick={() => onSelect(target.id)}
            >
              <span>
                {appearances[target.kind].name}
                {target.rank}阶 · 编号{target.id}
                {target.id === model.sourceId && ' · 本狐自身'}
              </span>
              <small>
                {target.position.x + 1}列{target.position.y + 1}行 · 查看灵兽 ›
              </small>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
