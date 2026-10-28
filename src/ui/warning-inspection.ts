import type { Combat } from '../game/combat';
import type { Session } from '../game/session';
import { bossWarnings, type BossWarningTarget } from './boss-warnings';

/** Recheck the rendered warning before pausing; due can change while frozen. */
export function pauseForBossWarning(
  session: Session,
  battle: Combat,
  target: BossWarningTarget,
): BossWarningTarget | null {
  if (session.phase !== 'combat' || session.hasChoices || session.battle !== battle) return null;
  const current = bossWarnings(battle).find(
    (warning) =>
      warning.source === target.source &&
      warning.row === target.row &&
      warning.echo === target.echo,
  );
  if (!current) return null;
  session.pause(true);
  return { source: current.source, row: current.row, echo: current.echo };
}
