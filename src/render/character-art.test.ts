import { expect, test } from 'vitest';
import { mouseAnimations, mouseMotionArt, resolveMouseArt } from './character-art';

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
