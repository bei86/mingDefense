import type { ShieldSourcesModel } from './shield-coverage';

type Props = { model: ShieldSourcesModel | null; onSelect: (id: number) => void };

export function ShieldSources({ model, onSelect }: Props) {
  if (!model) return null;
  if (!model.alive) return <p>此灵兽已倒下，当前不列施盾可达来源。</p>;
  return (
    <details className="battle-aura-coverage">
      <summary>施盾可达来源 · {model.sources.length}只</summary>
      <p>
        仅列当前施盾范围覆盖此灵兽的存活月音狐，按整体中心距离计算，含来源狐的射程天赋。
        可达不表示已准备施盾或下一次获盾，也不追溯已有护盾来源。
      </p>
      {model.sources.length > 0 ? (
        <ul className="battle-aura-sources" aria-label="当前施盾可达来源名单">
          {model.sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className="secondary battle-aura-source"
                aria-label={`查看施盾可达来源：月音狐${source.rank}阶，${source.position.x + 1}列${source.position.y + 1}行，编号${source.id}`}
                onClick={() => onSelect(source.id)}
              >
                <span>
                  月音狐{source.rank}阶 · 编号{source.id}
                  {source.id === model.targetId && ' · 自身施盾'}
                </span>
                <small>
                  {source.position.x + 1}列{source.position.y + 1}行 · 当前射程{' '}
                  {Number(source.range.toFixed(2))} 格 · 查看来源 ›
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>当前没有存活月音狐的施盾范围覆盖此灵兽。</p>
      )}
    </details>
  );
}
