import { expect, test } from 'vitest';
import { motionPreviewRequested, motionPreviewUrl } from './motion-preview-route';

test('开发入口严格匹配，正确预览优先于旧试玩参数，生产永不进入', () => {
  expect(motionPreviewRequested('?preview=mouse-motion', true)).toBe(true);
  expect(motionPreviewRequested('?playtest=roster&preview=mouse-motion&perf=1', true)).toBe(true);
  expect(motionPreviewRequested('?preview=mouse-motion', false)).toBe(false);
  for (const search of ['', '?preview=mouse', '?preview=toString', '?playtest=mouse-motion'])
    expect(motionPreviewRequested(search, true)).toBe(false);
});

test('嵌套部署保留pathname，只带预览参数，不继承旧方案与hash', () => {
  const current = new URL('https://example.test/game/?playtest=ranged8&perf=1#old');
  expect(motionPreviewUrl(current.pathname)).toBe('/game/?preview=mouse-motion');
});
