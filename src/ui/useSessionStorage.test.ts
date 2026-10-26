import { afterEach, expect, test, vi } from 'vitest';
import { loadBrowserSession } from './useSessionStorage';

afterEach(() => vi.unstubAllGlobals());

test.each(['', '&case=setback&variant=candidate', '&case=invalid&variant=invalid'])(
  '远程对照试玩%s绕过正式存储',
  (params) => {
    const getItem = vi.fn(() => {
      throw Error('正式读取');
    });
    const setItem = vi.fn(() => {
      throw Error('正式写入');
    });
    vi.stubGlobal('window', {
      location: { search: `?playtest=ranged8${params}` },
      localStorage: { getItem, setItem },
    });
    const loaded = loadBrowserSession();
    expect(loaded.blocked).toBe(true);
    expect(loaded.isolated).toBe(true);
    expect(loaded.session.preparation.stageId).toBe(8);
    expect(loaded.rangedPlaytest?.caseId).toBe(params.includes('setback') ? 'setback' : 'relief');
    expect(loaded.rangedPlaytest?.variant).toBe(
      params.includes('candidate') ? 'candidate' : 'baseline',
    );
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  },
);

test.each([
  ['onboarding', 1, '开发首战试玩'],
  ['calibration20', 20, 'v18三格规则合法经济路线'],
  ['calibration25', 25, 'v19三格规则合法经济路线'],
  ['calibration30', 30, 'v20三格规则合法经济路线'],
  ['calibration35', 35, 'v21三格规则合法经济路线'],
  ['calibration40', 40, 'v22三格规则合法经济路线'],
  ['stage41', 41, 'v23三格规则合法控制路线'],
  ['stage45', 45, 'v23三格规则合法控制路线'],
  ['stage46', 46, 'v24三格规则合法控制路线'],
  ['stage50', 50, 'v24三格规则合法控制路线'],
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
  expect(loaded.isolated).toBe(true);
  expect(loaded.recovered).toBe(false);
  expect(loaded.session.preparation.stageId).toBe(stageId);
  expect(loaded.message).toContain(source);
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

test('正式存储读取失败不标记为开发隔离，仍可导出当前进度自救', async () => {
  vi.resetModules();
  vi.stubGlobal('window', {
    location: { search: '' },
    localStorage: {
      getItem: () => {
        throw new Error('blocked');
      },
    },
  });
  const { loadBrowserSession: load } = await import('./useSessionStorage');
  const loaded = load();
  expect(loaded.blocked).toBe(true);
  expect(loaded.isolated).not.toBe(true);
  expect(loaded.session.exportSave().preparation.stageId).toBe(1);
});
