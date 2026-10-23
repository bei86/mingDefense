import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameClock } from '../game/clock';
import { Session } from '../game/session';
import { startGameLoop } from '../ui/game-loop';
import { RendererRecovery, type RendererRecoveryState } from './renderer-recovery';

function frames() {
  const events = new EventTarget();
  return {
    on: vi.fn((event: string, listener: () => void) => events.addEventListener(event, listener)),
    off: vi.fn((event: string, listener: () => void) =>
      events.removeEventListener(event, listener),
    ),
    emit: (event: string) => events.dispatchEvent(new Event(event)),
  };
}

function setup() {
  const canvas = new EventTarget();
  const renderer = { ...frames(), contextLost: false };
  const ready = vi.fn();
  const state = vi.fn();
  const recovery = new RendererRecovery(ready, state);
  recovery.attach(canvas, renderer);
  const frame = () => renderer.emit('postrender');
  const lose = () => {
    renderer.contextLost = true;
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    return event;
  };
  const restore = () => {
    renderer.contextLost = false;
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  };
  return { canvas, renderer, ready, state, recovery, frame, lose, restore };
}

afterEach(() => vi.useRealTimers());

describe('战场渲染中断恢复', () => {
  it('加载完成前的帧不解锁，完成后真实首帧只通知一次', () => {
    const t = setup();
    t.frame();
    expect(t.ready).not.toHaveBeenCalled();
    t.recovery.created();
    expect(t.ready).not.toHaveBeenCalled();
    t.frame();
    t.frame();
    expect(t.ready.mock.calls).toEqual([[true]]);
  });

  it('Canvas渲染器没有contextLost标记时仍正常进入首帧', () => {
    const renderer = frames();
    const ready = vi.fn();
    const canvasRecovery = new RendererRecovery(ready, vi.fn());
    canvasRecovery.attach(new EventTarget(), renderer);
    canvasRecovery.created();
    renderer.emit('postrender');
    expect(ready).toHaveBeenCalledWith(true);
    canvasRecovery.dispose();
  });

  it('丢失立即关门并允许浏览器恢复，恢复事件不能直接解锁', () => {
    const t = setup();
    t.recovery.created();
    t.frame();
    expect(t.lose().defaultPrevented).toBe(true);
    expect(t.ready).toHaveBeenLastCalledWith(false);
    expect(t.state).toHaveBeenLastCalledWith('lost');
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(false);
    t.restore();
    expect(t.state).toHaveBeenLastCalledWith('restoring');
    expect(t.ready).toHaveBeenLastCalledWith(false);
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(true);
    expect(t.state).toHaveBeenLastCalledWith(null);
  });

  it('加载中丢失，场景创建和假帧都不能绕过恢复', () => {
    const t = setup();
    t.lose();
    t.recovery.created();
    t.renderer.contextLost = false;
    t.frame();
    expect(t.ready.mock.calls).toEqual([[false]]);
    t.restore();
    t.frame();
    expect(t.ready.mock.calls).toEqual([[false], [true]]);
  });

  it('恢复发生在场景创建之前仍等待场景及其首帧', () => {
    const t = setup();
    t.lose();
    t.restore();
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(false);
    t.recovery.created();
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(true);
  });

  it('资源仍丢失时忽略恢复事件和postrender，反复丢失也不会误解锁', () => {
    const t = setup();
    t.recovery.created();
    t.lose();
    t.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(t.state.mock.calls).toEqual([['lost']]);
    t.restore();
    t.lose();
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(false);
    t.restore();
    t.renderer.contextLost = true;
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(false);
    t.renderer.contextLost = false;
    t.frame();
    expect(t.ready).toHaveBeenLastCalledWith(true);
  });

  it('绑定时已丢失也报告中断，销毁移除监听且旧回调不能解锁', () => {
    const t = setup();
    t.recovery.dispose();
    t.renderer.contextLost = true;
    const ready = vi.fn();
    const state = vi.fn();
    const recovery = new RendererRecovery(ready, state);
    recovery.attach(t.canvas, t.renderer);
    expect(state).toHaveBeenCalledWith('lost');
    const staleFrame = t.renderer.on.mock.calls.at(-1)![1];
    recovery.dispose();
    recovery.created();
    recovery.attach(t.canvas, t.renderer);
    t.restore();
    t.frame();
    staleFrame();
    expect(ready.mock.calls).toEqual([[false]]);
    expect(t.renderer.off).toHaveBeenLastCalledWith('postrender', staleFrame);
  });

  it('同一实例重复attach不重复监听，正常卸载也无残留回调', () => {
    const t = setup();
    t.recovery.attach(t.canvas, t.renderer);
    expect(t.renderer.on).toHaveBeenCalledTimes(1);
    t.recovery.dispose();
    t.lose();
    t.restore();
    t.frame();
    expect(t.ready).not.toHaveBeenCalled();
    expect(t.state).not.toHaveBeenCalled();
  });

  it.each([false, true])('真实战斗中断保留状态、暂停和资源，无补跑（原暂停=%s）', (paused) => {
    vi.useFakeTimers();
    const session = new Session(20261014);
    session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    expect(session.start()).toBeNull();
    session.pause(paused);
    const clock = new GameClock(session);
    let ready = false;
    const t = setup();
    t.recovery.dispose();
    const recovery = new RendererRecovery(
      (value) => {
        ready = value;
        clock.reset();
      },
      (state: RendererRecoveryState) => {
        if (state) session.pause(true);
      },
    );
    recovery.attach(t.canvas, t.renderer);
    recovery.created();
    t.frame();
    const stop = startGameLoop(
      clock,
      () => {},
      undefined,
      () => ready,
    );
    vi.advanceTimersByTime(200);
    session.held = true;
    t.lose();
    expect(session.held).toBe(false);
    const battle = structuredClone(session.battle);
    const preparation = structuredClone(session.preparation);
    const revision = session.revision;
    vi.advanceTimersByTime(30000);
    expect(session.battle).toEqual(battle);
    t.restore();
    vi.advanceTimersByTime(30000);
    expect(ready).toBe(false);
    t.frame();
    expect(ready).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(session.paused).toBe(true);
    expect(session.battle).toEqual(battle);
    expect(session.preparation).toEqual(preparation);
    expect(session.revision).toBe(revision);
    session.pause(false);
    clock.reset();
    vi.advanceTimersByTime(75);
    expect(session.battle!.time).toBe(battle!.time + 50);
    stop();
    recovery.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
