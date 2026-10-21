import type { GameClock } from '../game/clock';

/** Simulation scheduling stays independent of Phaser's visual frame rate. */
export function startGameLoop(clock: GameClock, repaint: () => void): () => void {
  let lastHud = performance.now();
  clock.advance(lastHud);
  const timer = setInterval(() => {
    const now = performance.now();
    clock.advance(now);
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
