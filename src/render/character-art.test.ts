import { expect, test } from 'vitest';
import {
  boarAttackArt,
  boarMotionArt,
  characterAnimations,
  mouseAnimations,
  mouseMotionArt,
  resolveBoarArt,
  resolveMouseArt,
  resolveSwordEagleArt,
  swordEagleAttackArt,
  swordEagleMotionArt,
} from './character-art';

test('动作纹理独立降级，缺某张仍显示其他可用动作，全部缺失交回旧静态图', () => {
  for (const [action, art] of Object.entries(mouseMotionArt)) {
    const motion = { action: action as keyof typeof mouseMotionArt, frame: art.frames - 1 };
    const onlyThis = (key: string) => key === art.key;
    expect(resolveMouseArt(motion, onlyThis)).toEqual({ key: art.key, frame: motion.frame });
  }
  expect(
    resolveMouseArt({ action: 'fallen', frame: 4 }, (key) => key === mouseMotionArt.attack.key),
  ).toEqual({ key: mouseMotionArt.attack.key, frame: 0 });
  expect(
    resolveMouseArt({ action: 'attack', frame: 3 }, (key) => key === mouseMotionArt.idle.key),
  ).toEqual({ key: mouseMotionArt.idle.key, frame: 0 });
  expect(resolveMouseArt({ action: 'hurt', frame: 2 }, () => false)).toBeNull();
  expect(new Set(mouseAnimations.map((art) => art.key)).size).toBe(4);
});

test('岩甲豚使用独立动作纹理，缺失时交回原静态图；公共清单无重名', () => {
  for (const [action, art] of Object.entries(boarMotionArt)) {
    const motion = { action: action as keyof typeof boarMotionArt, frame: art.frames - 1 };
    expect(resolveBoarArt(motion, (key) => key === art.key)).toEqual({
      key: art.key,
      frame: motion.frame,
    });
  }
  expect(resolveBoarArt({ action: 'hurt', frame: 1 }, (key) => key === boarAttackArt.key)).toEqual({
    key: boarAttackArt.key,
    frame: 0,
  });
  expect(
    resolveBoarArt({ action: 'fallen', frame: 4 }, (key) => key === boarMotionArt.idle.key),
  ).toEqual({
    key: boarMotionArt.idle.key,
    frame: 0,
  });
  expect(resolveBoarArt({ action: 'attack', frame: 3 }, () => false)).toBeNull();
  expect(characterAnimations).toHaveLength(12);
  expect(new Set(characterAnimations.map((art) => art.key)).size).toBe(characterAnimations.length);
});

test('青锋隼六帧纹理缺失时回退旧立绘，悬空振翼包络完整留在2×2显示区', () => {
  expect(
    resolveSwordEagleArt({ action: 'attack', frame: 3 }, (key) => key === swordEagleAttackArt.key),
  ).toEqual({
    key: swordEagleAttackArt.key,
    frame: 3,
  });
  expect(resolveSwordEagleArt({ action: 'idle', frame: 0 }, () => false)).toBeNull();
  const art = swordEagleAttackArt;
  const scale = Math.min(94 / art.width, 88 / art.height);
  const origin = [art.originX * art.frameWidth, art.originY * art.frameHeight];
  for (const [x, y] of [
    [75, 51],
    [414, 309],
  ]) {
    expect(Math.abs((x - origin[0]) * scale)).toBeLessThanOrEqual(47);
    expect(Math.abs((y - origin[1]) * scale)).toBeLessThanOrEqual(44);
  }
});

test('鹰动作独立降级，缺三种动作仍有可用基准，全部缺失交回旧立绘', () => {
  for (const [action, art] of Object.entries(swordEagleMotionArt)) {
    const motion = { action: action as keyof typeof swordEagleMotionArt, frame: art.frames - 1 };
    expect(resolveSwordEagleArt(motion, (key) => key === art.key)).toEqual({
      key: art.key,
      frame: motion.frame,
    });
  }
  expect(
    resolveSwordEagleArt({ action: 'fallen', frame: 4 }, (key) => key === swordEagleAttackArt.key),
  ).toEqual({ key: swordEagleAttackArt.key, frame: 0 });
  expect(
    resolveSwordEagleArt(
      { action: 'attack', frame: 3 },
      (key) => key === swordEagleMotionArt.idle.key,
    ),
  ).toEqual({ key: swordEagleMotionArt.idle.key, frame: 0 });
});
