import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClock } from '../game/clock';
import { Session } from '../game/session';
import { startGameLoop } from './game-loop';

function battleSession(): Session {
  const session = new Session(20261014);
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  session.transfer({ type: 'offer', id: 2 }, { merge: 5 });
  session.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
  session.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  expect(session.start()).toBeNull();
  return session;
}

describe('independent simulation scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubGlobal('requestAnimationFrame', () => {
      throw new Error('Simulation must not depend on a visual frame');
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([1, 2] as const)(
    'advances at %s× without visual frames and limits HUD to 10Hz',
    (speed) => {
      const session = battleSession();
      session.speed = speed;
      const repaint = vi.fn();
      const stop = startGameLoop(new GameClock(session), repaint);
      vi.advanceTimersByTime(1000);
      expect(session.battle!.time).toBe(1000 * speed);
      expect(session.battle!.spawnIndex).toBe(speed);
      expect(repaint).toHaveBeenCalledTimes(10);
      stop();
    },
  );

  it('matches the fixed-step simulation through a full battle and talent choices', () => {
    const scheduled = battleSession();
    const direct = battleSession();
    const stop = startGameLoop(new GameClock(scheduled), () => {});
    for (let tick = 0; tick < 4000 && direct.phase === 'combat'; tick++) {
      if (direct.hasChoices) {
        expect(scheduled.hasChoices).toBe(true);
        const choice = direct.battle!.choices[0];
        direct.chooseBuff(choice);
        scheduled.chooseBuff(choice);
        // The clock establishes a new baseline after an inactive choice frame.
        vi.advanceTimersByTime(25);
      }
      direct.tick();
      vi.advanceTimersByTime(50);
      expect(scheduled.battle).toEqual(direct.battle);
      if (direct.hasChoices) vi.advanceTimersByTime(25);
    }
    expect(scheduled.phase).toBe('victory');
    expect(scheduled.preparation).toEqual(direct.preparation);
    stop();
  });

  it('freezes while paused, clears held boost and resumes without catching up', () => {
    const session = battleSession();
    const stop = startGameLoop(new GameClock(session), () => {});
    vi.advanceTimersByTime(375);
    session.held = true;
    session.pause(true);
    expect(session.held).toBe(false);
    const before = structuredClone(session.battle);
    vi.advanceTimersByTime(30000);
    expect(session.battle).toEqual(before);
    session.pause(false);
    vi.advanceTimersByTime(25);
    expect(session.battle).toEqual(before);
    vi.advanceTimersByTime(50);
    expect(session.battle!.time).toBe(before!.time + 50);
    stop();
  });

  it('freezes the entire battle while waiting for a real talent choice', () => {
    const session = battleSession();
    while (!session.hasChoices && session.phase === 'combat') session.tick();
    expect(session.hasChoices).toBe(true);
    const before = structuredClone(session.battle);
    const stop = startGameLoop(new GameClock(session), () => {});
    vi.advanceTimersByTime(30000);
    expect(session.battle).toEqual(before);
    session.chooseBuff(session.battle!.choices[0]);
    vi.advanceTimersByTime(75);
    expect(session.battle!.time).toBe(before!.time + 50);
    stop();
  });

  it('drops a long main-thread stall and resumes regular fixed steps', () => {
    let gap = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() + gap);
    const session = battleSession();
    const stop = startGameLoop(new GameClock(session), () => {});
    vi.advanceTimersByTime(125);
    expect(session.battle!.time).toBe(100);
    gap = 10000;
    vi.advanceTimersByTime(25);
    expect(session.battle!.time).toBe(100);
    vi.advanceTimersByTime(100);
    expect(session.battle!.time).toBe(200);
    stop();
  });

  it('cleans up on unmount and remounts with one fresh timer and no elapsed debt', () => {
    const session = battleSession();
    const clock = new GameClock(session);
    const repaint = vi.fn();
    const stop = startGameLoop(clock, repaint);
    vi.advanceTimersByTime(125);
    stop();
    const before = structuredClone(session.battle);
    const renders = repaint.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(session.battle).toEqual(before);
    expect(repaint).toHaveBeenCalledTimes(renders);
    expect(vi.getTimerCount()).toBe(0);
    const stopAgain = startGameLoop(clock, repaint);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(50);
    expect(session.battle!.time).toBe(before!.time + 50);
    stopAgain();
  });
});
