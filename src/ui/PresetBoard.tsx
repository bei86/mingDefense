import { appearances, config, heroes } from '../game/content';
import type { FormationPreset } from '../game/formation-presets';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';

export function PresetBoard({ preset }: { preset: FormationPreset }) {
  return (
    <>
      <div className="preset-board" role="img" aria-label="预设完整占格，上方为前排">
        {Array.from({ length: config.board.columns * config.board.rows }, (_, i) => (
          <span
            className="preset-cell"
            key={i}
            style={{
              gridColumn: (i % config.board.columns) + 1,
              gridRow: Math.floor(i / config.board.columns) + 1,
            }}
          />
        ))}
        {preset.units.map(
          (unit, i) =>
            unit.position && (
              <span
                className="preset-unit"
                key={i}
                title={`${appearances[unit.kind].name}${unit.rank}阶：${unit.position.x + 1}列${unit.position.y + 1}行`}
                style={{
                  gridColumn: `${unit.position.x + 1} / span ${Math.max(...heroes[unit.kind].shape.map(([x]) => x)) + 1}`,
                  gridRow: `${unit.position.y + 1} / span ${Math.max(...heroes[unit.kind].shape.map(([, y]) => y)) + 1}`,
                }}
              >
                <ArtImage key={unit.kind} asset={heroArt[unit.kind]} />
                <small>
                  {appearances[unit.kind].glyph}
                  {unit.rank}
                </small>
              </span>
            ),
        )}
      </div>
      <p className="preset-reserves">
        备战席：
        {preset.units
          .filter((unit) => unit.position === null)
          .map((unit) => `${appearances[unit.kind].name}${unit.rank}阶`)
          .join('、') || '无'}
      </p>
    </>
  );
}
