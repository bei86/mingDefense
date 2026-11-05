import { config, key } from '../content';
import { Session } from '../session';

/** Artificial formation for animation inspection; combat uses the unmodified stage 1 rules. */
class MouseCombatSession extends Session {
  constructor() {
    super(20261104);
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.preparation.unlocked = Array.from(
      { length: config.board.columns * config.board.rows },
      (_, i) => key({ x: i % config.board.columns, y: Math.floor(i / config.board.columns) }),
    );
    this.preparation.units = [
      { id: 5, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 0 } },
      { id: 6, kind: 'ember_mouse', rank: 2, position: { x: 4, y: 3 } },
    ];
    this.preparation.nextId = 7;
    this.preparation.offers.forEach((offer) => {
      offer.claimed = true;
    });
  }

  override retry(): string | null {
    if (this.hasChoices) return '请先完成天赋选择';
    this.reset();
    return this.start();
  }

  override backToPreparation(): void {
    if (this.phase === 'victory') {
      if (!this.hasChoices) this.reset();
      return;
    }
    super.backToPreparation();
  }

  override nextStage(): string {
    return '本场景仅用于烬灵鼠实战动作对照，请重置样板或返回正式战役';
  }
}

export function mouseCombatPlaytest(): Session {
  return new MouseCombatSession();
}
