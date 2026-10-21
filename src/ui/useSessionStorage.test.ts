import { afterEach, expect, test, vi } from 'vitest';
import { loadBrowserSession } from './useSessionStorage';

afterEach(() => vi.unstubAllGlobals());

test('开发校准入口不读取正式存档，并向保存钩子传递禁写标记', () => {
  const getItem = vi.fn(() => {
    throw new Error('Must not read formal save');
  });
  const setItem = vi.fn(() => {
    throw new Error('Must not write formal save');
  });
  vi.stubGlobal('window', {
    location: { search: '?playtest=calibration20' },
    localStorage: { getItem, setItem },
  });
  const loaded = loadBrowserSession();
  expect(loaded.blocked).toBe(true);
  expect(loaded.recovered).toBe(false);
  expect(loaded.session.preparation.stageId).toBe(20);
  expect(loaded.message).toContain('v18三格规则合法经济路线');
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
