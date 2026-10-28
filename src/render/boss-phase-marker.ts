import type Phaser from 'phaser';
import type { Enemy } from '../game/combat-model';
import type { Point } from '../game/content';

/** Static, view-only phase cue; shared by portraits and geometric fallbacks. */
export function drawBossPhaseMarker(
  ground: Phaser.GameObjects.Graphics,
  overlay: Phaser.GameObjects.Graphics,
  enemy: Pick<Enemy, 'kind' | 'hp' | 'phase2'>,
  point: Point,
): void {
  if (enemy.kind !== 'boss' || !enemy.phase2 || enemy.hp <= 0) return;
  const { x, y } = point;
  const gold = 0xffcd8a;
  ground.lineStyle(2, gold, 0.85).strokeEllipse(x, y + 28, 72, 22);
  ground.fillStyle(gold, 0.1).fillEllipse(x, y + 28, 72, 22);
  const badgeX = x + 33;
  const badgeY = y - 34;
  overlay.fillStyle(0x21392e, 0.95).fillRoundedRect(badgeX - 9, badgeY - 10, 18, 20, 4);
  overlay.lineStyle(1, gold, 1).strokeRoundedRect(badgeX - 9, badgeY - 10, 18, 20, 4);
  overlay
    .lineStyle(2, gold, 1)
    .lineBetween(badgeX - 3, badgeY - 5, badgeX - 3, badgeY + 5)
    .lineBetween(badgeX + 3, badgeY - 5, badgeX + 3, badgeY + 5);
}
