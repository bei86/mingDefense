import type { BattleStatsModel } from './battle-stats';

type Props = {
  sources: BattleStatsModel['auraSources'];
  onSelect: (id: number) => void;
};

export function AuraSources({ sources, onSelect }: Props) {
  if (sources.length === 0) return null;
  return (
    <ul className="battle-aura-sources" aria-label="存活攻击光环来源">
      {sources.map((source) => (
        <li key={source.id}>
          <button
            type="button"
            className="secondary battle-aura-source"
            aria-label={`查看光环来源：月音狐${source.rank}阶，${source.position.x + 1}列${source.position.y + 1}行，编号${source.id}`}
            onClick={() => onSelect(source.id)}
          >
            <span>
              月音狐{source.rank}阶 · 编号{source.id}
            </span>
            <small>
              {source.position.x + 1}列{source.position.y + 1}行 · 查看来源 ›
            </small>
          </button>
        </li>
      ))}
    </ul>
  );
}
