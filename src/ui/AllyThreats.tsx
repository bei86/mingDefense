import { useState } from 'react';
import type { InspectedEnemy } from './enemy-inspection';
import './inspection-links.css';

type Props = { enemies: readonly InspectedEnemy[]; onSelect: (id: number) => void };

export function AllyThreats({ enemies, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (enemies.length === 0) return null;
  return (
    <details
      className="inspection-threats"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>锁定此灵兽的敌人 · {enemies.length}只</summary>
      {expanded && (
        <div className="inspection-threats-content">
          <ul aria-label="锁定此灵兽的敌人">
            {enemies.map((enemy) => (
              <li key={enemy.id}>
                <button
                  type="button"
                  className="secondary inspection-link"
                  aria-label={`查看锁定敌人：${enemy.name}，编号${enemy.id}，生命${enemy.hp}`}
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
          <p>按暂停时的缓存锁定列出，包含接近中的敌人，不代表下一击或首领横扫目标。</p>
        </div>
      )}
    </details>
  );
}
