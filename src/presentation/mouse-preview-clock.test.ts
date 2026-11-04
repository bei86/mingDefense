import { expect, test } from 'vitest';
import { MousePreviewClock } from './mouse-preview-clock';
import { mousePreviewClips } from './mouse-preview-clock';
import { mouseMotionArt } from '../render/character-art';

test('预览帧数与实际发布素材清单一致', () => {
  for (const action of ['idle', 'attack', 'hurt', 'fallen'] as const)
    expect(mousePreviewClips[action].count).toBe(mouseMotionArt[action].frames);
});

function advance(clock: MousePreviewClock, ms: number) {
  for (let left = ms; left > 0; left -= 100) clock.advance(Math.min(left, 100));
}

test('待机循环；一次动作到末帧停止，重播和切换从首帧开始', () => {
  const clock = new MousePreviewClock();
  advance(clock, 800);
  expect(clock.snapshot()).toMatchObject({ action: 'idle', frame: 0, playing: true });
  for (const action of ['attack', 'hurt', 'fallen'] as const) {
    clock.select(action);
    advance(clock, 1000);
    const view = clock.snapshot();
    expect(view.frame).toBe(view.count - 1);
    expect(view.playing).toBe(false);
    clock.replay();
    expect(clock.snapshot()).toMatchObject({ frame: 0, playing: true });
  }
});

test('暂停、逐帧与滑条同步游标，恢复从所选帧继续；末帧播放会重来', () => {
  const clock = new MousePreviewClock();
  clock.select('attack');
  clock.step(1);
  expect(clock.snapshot()).toMatchObject({ frame: 1, playing: false });
  advance(clock, 1000);
  expect(clock.snapshot().frame).toBe(1);
  clock.toggle();
  clock.advance(70);
  expect(clock.snapshot()).toMatchObject({ frame: 2, playing: true });
  clock.seek(4);
  clock.step(-1);
  expect(clock.snapshot()).toMatchObject({ frame: 3, playing: false });
  clock.seek(999);
  expect(clock.snapshot().frame).toBe(5);
  clock.toggle();
  expect(clock.snapshot()).toMatchObject({ frame: 0, playing: true });
  clock.seek(-10);
  expect(clock.snapshot().frame).toBe(0);
});

test('后台/暂停不推进，超长delta不补跑，2倍速仅影响预览', () => {
  const clock = new MousePreviewClock();
  clock.advance(100, false);
  expect(clock.snapshot().frame).toBe(0);
  clock.advance(5000);
  expect(clock.snapshot().frame).toBe(0);
  clock.speed = 2;
  clock.advance(100);
  expect(clock.snapshot().frame).toBe(1);
  clock.toggle();
  const before = clock.snapshot();
  clock.advance(100);
  expect(clock.snapshot()).toEqual(before);
});

test('减少动态暂停并固定活体首帧、重伤末帧，不自动恢复播放', () => {
  const clock = new MousePreviewClock();
  clock.setReduced(true);
  expect(clock.snapshot()).toMatchObject({ frame: 0, playing: false, reduced: true });
  clock.select('fallen');
  clock.replay();
  clock.step(-1);
  clock.seek(1);
  clock.toggle();
  clock.advance(100);
  expect(clock.snapshot()).toMatchObject({ frame: 4, playing: false });
  clock.setReduced(false);
  expect(clock.snapshot()).toMatchObject({ frame: 4, playing: false });
  clock.replay();
  expect(clock.snapshot()).toMatchObject({ frame: 0, playing: true });
  clock.select('hurt');
  clock.setReduced(true);
  expect(clock.snapshot()).toMatchObject({ action: 'hurt', frame: 0, playing: false });
});
