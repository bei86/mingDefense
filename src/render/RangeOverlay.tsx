import { useId } from 'react';
import type { RangePreview } from '../ui/preparation-range';

export function RangeOverlay({ preview }: { preview: RangePreview }) {
  const clipId = useId();
  if (!preview.point || !preview.circles.length) return null;
  const cx = 24 + preview.point.x * 52;
  const cy = 74 + preview.point.y * 52;
  return (
    <svg className="range-overlay" viewBox="0 0 360 416" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="24" y="74" width="312" height="312" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {preview.circles.map((circle) => (
          <circle
            key={circle.kind}
            className={`range-circle range-${circle.kind}`}
            cx={cx}
            cy={cy}
            r={circle.radius * 52}
          />
        ))}
        <circle className="range-center" cx={cx} cy={cy} r="3" />
        {preview.covered.map((unit) => (
          <g key={unit.id}>
            {unit.shield && (
              <circle
                className="range-covered-shield"
                cx={24 + unit.point.x * 52}
                cy={74 + unit.point.y * 52}
                r="7"
              />
            )}
            {unit.aura && (
              <circle
                className="range-covered-aura"
                cx={24 + unit.point.x * 52}
                cy={74 + unit.point.y * 52}
                r="10"
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
