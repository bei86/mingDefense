import { useState } from 'react';
import { appearances, config, heroes } from '../game/content';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import type { InspectedAlly } from './battle-inspection';
import './inspection-formation.css';

type Props = {
  allies: readonly InspectedAlly[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
};

function label(unit: InspectedAlly): string {
  const name = `${appearances[unit.kind].name}${unit.rank}阶，${unit.position.x + 1}列${unit.position.y + 1}行起`;
  if (!unit.alive) return `查看${name}，已倒下`;
  return `查看${name}，生命${unit.hp}/${unit.maxHp}，被${unit.targetedBy}只敌人锁定`;
}

export function InspectionFormationBoard({ allies, selectedId, onSelect }: Props) {
  const selected = allies.find((unit) => unit.id === selectedId);
  return (
    <div className="inspection-formation-content">
      <p className="inspection-formation-direction">敌袭方向 ↓ · 上方为前排</p>
      <div
        className="inspection-formation-board"
        role="group"
        aria-label="暂停灵兽阵型，点选查看详情"
      >
        {Array.from({ length: config.board.columns * config.board.rows }, (_, i) => (
          <span
            className="inspection-formation-cell"
            key={i}
            aria-hidden="true"
            style={{
              gridColumn: (i % config.board.columns) + 1,
              gridRow: Math.floor(i / config.board.columns) + 1,
            }}
          />
        ))}
        {allies.map((unit) => {
          const shape = heroes[unit.kind].shape;
          const width = Math.max(...shape.map(([x]) => x)) + 1;
          const height = Math.max(...shape.map(([, y]) => y)) + 1;
          return (
            <button
              type="button"
              key={unit.id}
              className={`inspection-formation-unit ${unit.alive ? '' : 'fallen'}`}
              aria-label={label(unit)}
              aria-pressed={selectedId === unit.id}
              onClick={() => onSelect(unit.id)}
              style={{
                gridColumn: `${unit.position.x + 1} / span ${width}`,
                gridRow: `${unit.position.y + 1} / span ${height}`,
              }}
            >
              <ArtImage key={unit.kind} asset={heroArt[unit.kind]} />
              <small className="inspection-formation-rank" aria-hidden="true">
                {appearances[unit.kind].glyph}
                {unit.rank}
              </small>
              {!unit.alive && (
                <b className="inspection-formation-badge" aria-hidden="true">
                  伤
                </b>
              )}
              {unit.alive && unit.targetedBy > 0 && (
                <b className="inspection-formation-badge" aria-hidden="true">
                  锁{unit.targetedBy}
                </b>
              )}
              <span className="inspection-formation-health" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (unit.hp / unit.maxHp) * 100)}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="inspection-formation-selection" role="status">
          当前查看：{appearances[selected.kind].name}
          {selected.rank}阶 · {selected.position.x + 1}列{selected.position.y + 1}行起
        </p>
      )}
      <p>金框：当前查看 · 锁N：被N只敌人锁定 · 伤：已倒下</p>
      <p>
        点灵兽查看下方详情，也可用下拉选择。此图仅示灵兽站位；锁定包含接近中的敌人，不预测下一击或首领横扫。
      </p>
    </div>
  );
}

export function InspectionFormation(props: Props) {
  const [expanded, setExpanded] = useState(false);
  if (props.allies.length === 0) return null;
  return (
    <details
      className="inspection-formation"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>阵线总览</strong>
        <span>点选灵兽 · 查看受击压力</span>
      </summary>
      {expanded && <InspectionFormationBoard {...props} />}
    </details>
  );
}
