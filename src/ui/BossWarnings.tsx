import type { Combat } from '../game/combat';
import { bossWarnings, type BossWarning, type BossWarningTarget } from './boss-warnings';

export type InspectWarning = (battle: Combat, target: BossWarningTarget) => void;

function warningStatus(warning: BossWarning): string {
  if (warning.frozen) return '冻结中 · 释放延后';
  if (warning.remainingMs <= 0) return '待判定';
  return `约${Math.ceil(warning.remainingMs / 100) / 10}秒后判定`;
}

export function BossWarnings({
  battle,
  onInspectWarning,
}: {
  battle: Combat | null;
  onInspectWarning?: InspectWarning;
}) {
  const warnings = bossWarnings(battle);
  if (!warnings.length) return null;
  return (
    <div className="boss-warnings" role="group" aria-label="首领横扫预警">
      <ul>
        {warnings.slice(0, 2).map((warning, index) => (
          <li className={warning.echo ? 'echo' : ''} key={index}>
            {onInspectWarning && battle ? (
              <button
                type="button"
                className="boss-warning-inspect"
                aria-label={`暂停查看第${warning.row}行${warning.echo ? '追击' : '横扫'}预警`}
                onClick={() => onInspectWarning(battle, warning)}
              >
                <span>
                  {warning.echo ? '追击' : '横扫'} · 第{warning.row}行
                  <span className="boss-warning-time">{warningStatus(warning)}</span>
                </span>
                <span className="boss-warning-action">暂停查看 ›</span>
              </button>
            ) : (
              <>
                <span>
                  {warning.echo ? '追击' : '横扫'} · 第{warning.row}行
                </span>
                <span>{warningStatus(warning)}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      {warnings.length > 2 && <p>另有{warnings.length - 2}道预警</p>}
      <p>游戏内时间 · 释放时重新判定</p>
    </div>
  );
}
