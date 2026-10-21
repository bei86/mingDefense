import { afterEach, expect, test, vi } from 'vitest';
import { loadBrowserSession } from './useSessionStorage';

afterEach(() => vi.unstubAllGlobals());

test.each([
  ['calibration20', 20, 'v18三格规则合法经济路线'],
  ['calibration25', 25, 'v19三格规则合法经济路线'],
  ['calibration30', 30, 'v20三格规则合法经济路线'],
  ['calibration35', 35, 'v21三格规则合法经济路线'],
] as const)('%s开发校准入口不读取正式存档，并传递禁写标记', (entry, stageId, source) => {
  const getItem = vi.fn(() => {
    throw new Error('Must not read formal save');
  });
  const setItem = vi.fn(() => {
    throw new Error('Must not write formal save');
  });
  vi.stubGlobal('window', {
    location: { search: `?playtest=${entry}` },
    localStorage: { getItem, setItem },
  });
  const loaded = loadBrowserSession();
  expect(loaded.blocked).toBe(true);
  expect(loaded.recovered).toBe(false);
  expect(loaded.session.preparation.stageId).toBe(stageId);
  expect(loaded.message).toContain(source);
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
