import { useState } from 'react';
import type { Combat } from '../game/combat-model';
import { appearances, config } from '../game/content';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { battleFormation, formationStateLabels } from './battle-formation';
import './battle-formation.css';

type Props = { battle: Combat };

function FormationContent({
  battle,
  momentKey,
  onMoment,
}: Props & {
  momentKey: string;
  onMoment: (key: string) => void;
}) {
  const view = battleFormation(battle, momentKey);
  if (!view) return null;
  return (
    <div className="battle-formation-content">
      <label className="battle-formation-select">
        查看阵线时点
        <select value={view.selected.key} onChange={(event) => onMoment(event.target.value)}>
          {view.moments.map((moment) => (
            <option key={moment.key} value={moment.key}>
              {moment.label}
            </option>
          ))}
        </select>
      </label>
      <p className="battle-formation-count" role="status">
        仍在阵{' '}
        <strong>
          {view.standing}/{view.units.length}
        </strong>{' '}
        · 已重伤 <strong>{view.fallen}</strong>
      </p>
      <p className="battle-formation-direction">敌袭方向 ↓ · 上方为前排</p>
      <div
        className="battle-formation-board"
        role="img"
        aria-label={`${view.selected.label}的阵型，仍在阵${view.standing}只，已重伤${view.fallen}只，完整状态见下方逐兽列表`}
      >
        {Array.from({ length: config.board.columns * config.board.rows }, (_, i) => (
          <span
            className="battle-formation-cell"
            key={i}
            style={{
              gridColumn: (i % config.board.columns) + 1,
              gridRow: Math.floor(i / config.board.columns) + 1,
            }}
          />
        ))}
        {view.units.map((unit) => (
          <span
            className={`battle-formation-unit ${unit.state}`}
            key={unit.id}
            title={`${unit.label} · ${formationStateLabels[unit.state]}`}
            style={{
              gridColumn: `${unit.position.x + 1} / span ${unit.width}`,
              gridRow: `${unit.position.y + 1} / span ${unit.height}`,
            }}
          >
            <ArtImage key={unit.kind} asset={heroArt[unit.kind]} />
            {unit.state === 'fallen' && <b className="formation-state-badge">伤</b>}
            {unit.state === 'newly-fallen' && <b className="formation-state-badge">新伤</b>}
            <small>
              {appearances[unit.kind].glyph}
              {unit.rank}
            </small>
          </span>
        ))}
      </div>
      <p className="battle-formation-legend">绿框：仍在阵 · 伤：已重伤 · 新伤：本批重伤</p>
      <details className="battle-formation-roster">
        <summary>查看该时点逐兽状态</summary>
        <ul>
          {view.units.map((unit) => (
            <li key={unit.id}>
              {unit.label} · <strong>{formationStateLabels[unit.state]}</strong>
            </li>
          ))}
        </ul>
      </details>
      <p className="battle-formation-note">
        {view.historyRecorded
          ? '按每0.05秒的重伤批次查看阵线，同批不分先后。仅展示在阵与重伤，不是战斗回放。'
          : '这份旧战报未记录重伤时间，仅展示结束状态。'}
      </p>
    </div>
  );
}

export function BattleFormation({ battle }: Props) {
  const [open, setOpen] = useState(false);
  const [momentKey, setMomentKey] = useState('end');
  if (!battle.result) return null;
  return (
    <details className="battle-formation" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        阵型复盘图 <span>查看阵线变化</span>
      </summary>
      {open && <FormationContent battle={battle} momentKey={momentKey} onMoment={setMomentKey} />}
    </details>
  );
}
