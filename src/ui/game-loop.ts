import type { GameClock } from '../game/clock';

/** Simulation scheduling stays independent of Phaser's visual frame rate. */
export function startGameLoop(
  clock: GameClock,
  repaint: () => void,
  afterAdvance?: (elapsed: number) => void,
): () => void {
  let lastHud = performance.now();
  let lastSample = lastHud;
  clock.advance(lastHud);
  const timer = setInterval(() => {
    const now = performance.now();
    clock.advance(now);
    const elapsed = now - lastSample;
    afterAdvance?.(elapsed > 250 ? 0 : Math.max(0, elapsed));
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
