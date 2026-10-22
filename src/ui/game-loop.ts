import type { GameClock } from '../game/clock';

/** Simulation scheduling stays independent of Phaser's visual frame rate. */
export function startGameLoop(
  clock: GameClock,
  repaint: () => void,
  afterAdvance?: (elapsed: number) => void,
  canRun?: () => boolean,
): () => void {
  let lastHud = performance.now();
  let lastSample = lastHud;
  const advance = (now: number) => {
    if (canRun && !canRun()) {
      clock.reset();
      return false;
    }
    clock.advance(now);
    return true;
  };
  advance(lastHud);
  const timer = setInterval(() => {
    const now = performance.now();
    const running = advance(now);
    const elapsed = now - lastSample;
    afterAdvance?.(!running || elapsed > 250 ? 0 : Math.max(0, elapsed));
    lastSample = now;
    if (now - lastHud >= 100) {
      repaint();
      lastHud = now;
    }
  }, 25);
  return () => {
    clearInterval(timer);
    clock.reset();
  };
}
