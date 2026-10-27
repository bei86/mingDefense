import { expect, test, vi } from 'vitest';
import {
  DISPLAY_OPTIONS_KEY,
  displayEffects,
  readDisplayOptions,
  saveDisplayOptions,
} from './display-options';

function store(raw: string | null = null) {
  return { getItem: vi.fn(() => raw), setItem: vi.fn() };
}

test.each([
  null,
  '{',
  '{}',
  'null',
  '[]',
  '{"version":2,"numbers":true,"motion":"system"}',
  '{"version":1,"numbers":"off","motion":"system"}',
  '{"version":1,"numbers":false,"motion":"full"}',
])('无效或缺失偏好%s回退默认且不写回', (raw) => {
  const storage = store(raw);
  expect(readDisplayOptions(false, () => storage)).toEqual({ numbers: true, motion: 'system' });
  expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(DISPLAY_OPTIONS_KEY);
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('独立读写两项偏好，不接触战役或声音存储', () => {
  const storage = store('{"version":1,"numbers":false,"motion":"reduced"}');
  const options = readDisplayOptions(false, () => storage);
  expect(options).toEqual({ numbers: false, motion: 'reduced' });
  expect(saveDisplayOptions(options, false, () => storage)).toBe(true);
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
    DISPLAY_OPTIONS_KEY,
    JSON.stringify({ version: 1, ...options }),
  );
});

test('读写异常不阻止当前页使用；隔离试玩不调用存储', () => {
  const blocked = vi.fn(() => {
    throw Error('blocked');
  });
  expect(readDisplayOptions(false, blocked)).toEqual({ numbers: true, motion: 'system' });
  expect(saveDisplayOptions({ numbers: false, motion: 'reduced' }, false, blocked)).toBe(false);
  blocked.mockClear();
  expect(readDisplayOptions(true, blocked)).toEqual({ numbers: true, motion: 'system' });
  expect(saveDisplayOptions({ numbers: false, motion: 'reduced' }, true, blocked)).toBe(true);
  expect(blocked).not.toHaveBeenCalled();
});

test.each(['system', 'reduced'] as const)(
  '显示策略%s始终尊重系统减少动态，数字独立控制',
  (motion) => {
    expect(displayEffects({ numbers: false, motion }, true)).toEqual({
      numbers: false,
      reducedMotion: true,
    });
    expect(displayEffects({ numbers: true, motion }, false)).toEqual({
      numbers: true,
      reducedMotion: motion === 'reduced',
    });
  },
);

test('实际存储方法抛错时回退或返回失败，不泄露异常', () => {
  const storage = {
    getItem: () => {
      throw Error('read denied');
    },
    setItem: () => {
      throw Error('quota');
    },
  };
  expect(readDisplayOptions(false, () => storage)).toEqual({ numbers: true, motion: 'system' });
  expect(saveDisplayOptions({ numbers: false, motion: 'reduced' }, false, () => storage)).toBe(
    false,
  );
});
