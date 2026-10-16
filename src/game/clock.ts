import { config } from './content';
import type { Session } from './session';

export class GameClock {
  private previous: number | null = null;
  private accumulator = 0;
  constructor(private readonly session: Session) {}
  reset() {
    this.previous = null;
    this.accumulator = 0;
  }
  advance(now: number) {
    if (!this.session.canAdvance) {
      this.reset();
      return;
    }
    if (this.previous === null) {
      this.previous = now;
      return;
    }
    // Long browser stalls are frozen rather than replaying seconds of unseen combat.
    const elapsed = Math.max(0, now - this.previous);
    this.previous = now;
    if (elapsed > 250) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += elapsed * this.session.speed;
    while (this.accumulator >= config.runtime.tickMs && this.session.canAdvance) {
      this.session.tick();
      this.accumulator -= config.runtime.tickMs;
    }
    if (this.session.phase !== 'combat') this.reset();
  }
}
