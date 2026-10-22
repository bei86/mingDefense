import type Phaser from 'phaser';
import {
  COMBAT_NUMBER_DURATION,
  COMBAT_NUMBER_LIMIT,
  type CombatNumber,
} from '../presentation/combat-numbers';

export function combatNumberLabel(item: Pick<CombatNumber, 'kind' | 'amount'>): string {
  const integer = Math.ceil(item.amount);
  const value = integer < 10000 ? String(integer) : `${(integer / 10000).toFixed(1)}万`;
  return item.kind === 'shield' ? `盾 ${value}` : `-${value}`;
}

/** Bounded text pool, owned and destroyed by its Phaser scene. */
export class CombatNumberLayer {
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private density = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get stats(): { active: number; pooled: number } {
    return { active: this.used, pooled: this.texts.length };
  }

  draw(
    items: readonly CombatNumber[],
    time: number,
    density: number,
    reducedMotion: boolean,
  ): void {
    this.used = 0;
    const densityChanged = this.density !== density;
    this.density = density;
    const bounds = this.scene.cameras.main.worldView;
    const rows = new Map<string, number>();
    for (const item of items.slice(-COMBAT_NUMBER_LIMIT)) {
      const age = time - item.born;
      if (age < 0 || age >= COMBAT_NUMBER_DURATION) continue;
      const label = combatNumberLabel(item);
      const text =
        this.texts[this.used] ??
        this.scene.add
          .text(0, 0, '', {
            fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
            fontSize: '16px',
            fontStyle: 'bold',
            stroke: '#102b25',
            strokeThickness: 3,
            resolution: density,
          })
          .setOrigin(0.5)
          .setDepth(20);
      this.texts[this.used++] = text;
      if (densityChanged) text.setResolution(density);
      if (text.text !== label) text.setText(label);
      let color = item.team === 'ally' ? '#ffad96' : '#ffe2a0';
      if (item.kind === 'shield') color = '#e1c5ff';
      if (text.style.color !== color) text.setColor(color);
      const progress = age / COMBAT_NUMBER_DURATION;
      const lane = ((item.id % 3) - 1) * 10;
      const x = 24 + item.point.x * 52 + lane;
      const y = 74 + item.point.y * 52 - (item.kind === 'shield' ? 18 : 0);
      const lift = reducedMotion ? 0 : progress * 34;
      const rowKey = `${item.team}:${item.actorId}:${item.kind}`;
      const previousY = rows.get(rowKey);
      let rowY = y - lift;
      if (!reducedMotion && previousY !== undefined) rowY = Math.max(rowY, previousY + 22);
      rowY = Math.max(bounds.y + 14, Math.min(bounds.bottom - 14, rowY));
      rows.set(rowKey, rowY);
      const halfWidth = text.width / 2;
      text
        .setPosition(
          Math.max(bounds.x + halfWidth + 6, Math.min(bounds.right - halfWidth - 6, x)),
          rowY,
        )
        .setAlpha(reducedMotion ? 1 : Math.min(1, (1 - progress) * 3))
        .setVisible(true);
    }
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
}
