import { cells } from '../game/content';
import type { TargetingPreview } from '../ui/targeting-preview';

export function TargetingOverlay({ preview }: { preview: TargetingPreview }) {
  if (!preview.first) return null;
  const first = preview.first;
  const arrowX = 24 + (preview.column + 0.5) * 52;
  return (
    <svg className="targeting-overlay" viewBox="0 0 360 416" aria-hidden="true">
      <path
        className="targeting-entry"
        d={`M ${arrowX - 6} 60 L ${arrowX + 6} 60 L ${arrowX} 69 Z`}
      />
      {preview.rows[0].units.map((unit) => (
        <g key={unit.id} className={unit.id === first.id ? 'targeting-primary' : 'targeting-front'}>
          {cells(unit.kind, unit.position).map((point) => (
            <rect
              key={`${point.x},${point.y}`}
              x={24 + point.x * 52 + 3}
              y={74 + point.y * 52 + 3}
              width="46"
              height="46"
              rx="5"
            />
          ))}
        </g>
      ))}
      <g
        className="targeting-marker"
        transform={`translate(${24 + first.position.x * 52 + 13},${74 + first.position.y * 52 + 13})`}
      >
        <circle r="11" />
        <text textAnchor="middle" dominantBaseline="central">
          先
        </text>
      </g>
    </svg>
  );
}
