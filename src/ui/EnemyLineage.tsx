import { useState } from 'react';
import type { EnemyLineageModel } from './enemy-lineage';
import './inspection-links.css';

type ListProps = { enemies: EnemyLineageModel['children']; onSelect: (id: number) => void };

export function EnemyLineageList({ enemies, onSelect }: ListProps) {
  return (
    <div className="inspection-threats-content">
      <ul aria-label="直属存活衍生名单">
        {enemies.map((enemy) => (
          <li key={enemy.id}>
            <button
              type="button"
              className="secondary inspection-link"
              aria-label={`查看衍生敌人：${enemy.name}，编号${enemy.id}，生命${enemy.hp}`}
              onClick={() => onSelect(enemy.id)}
            >
              <span>
                {enemy.name} · #{enemy.id}
              </span>
              <small>生命 {enemy.hp} ›</small>
            </button>
          </li>
        ))}
      </ul>
      <p>
        仅列此实例的直属存活衍生，不含其他来源、已退场者或尚未生成的敌人。点选后显示全部种类并定位编号，战斗保持暂停。
      </p>
    </div>
  );
}

type Props = { model: EnemyLineageModel | null; onSelect: (id: number) => void };

export function EnemyLineage({ model, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!model) return null;
  const source = model.source;
  return (
    <>
      <dl className="enemy-state">
        {model.origin && (
          <div>
            <dt>衍生来源</dt>
            <dd>
              {model.origin}
              {source && (
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看来源敌人：${source.name}，编号${source.id}`}
                  onClick={() => onSelect(source.id)}
                >
                  查看来源敌人 ›
                </button>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>直属存活衍生</dt>
          <dd>{model.children.length} 只</dd>
        </div>
      </dl>
      {model.children.length > 0 && (
        <details
          className="inspection-threats"
          open={expanded}
          onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
          <summary>直属存活衍生 · {model.children.length}只</summary>
          {expanded && <EnemyLineageList enemies={model.children} onSelect={onSelect} />}
        </details>
      )}
    </>
  );
}
