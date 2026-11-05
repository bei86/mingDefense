import { afterEach, expect, test, vi } from 'vitest';
import { loadBrowserSession } from './useSessionStorage';
import { playtestScenes, playtestUrl } from './playtest-scenes';
import { SAVE_KEY } from '../game/persistence';
import { Session } from '../game/session';

afterEach(() => vi.unstubAllGlobals());

test.each(['onboarding', 'roster', 'mouse-combat', 'ranged8', 'calibration40', 'stage50'])(
  '%s目录目标实际加载隔离开局，不触及正式存储',
  (id) => {
    const entry = playtestScenes.find((scene) => scene.id === id)!;
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    const path = playtestUrl(id, true, '/game/')!;
    const url = new URL(path, 'https://example.test');
    vi.stubGlobal('window', { location: { search: url.search }, localStorage: storage });
    const loaded = loadBrowserSession();
    expect(loaded).toMatchObject({ isolated: true, blocked: true, recovered: false });
    expect(loaded.session.preparation.stageId).toBe(entry.stage);
    expect(url.pathname).toBe('/game/');
    expect([...url.searchParams.keys()]).toEqual(['playtest', 'perf']);
    expect(url.searchParams.get('perf')).toBe('1');
    for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled();
    if (id === 'ranged8')
      expect(loaded.rangedPlaytest).toMatchObject({ caseId: 'relief', variant: 'baseline' });
    if (id === 'roster') expect(loaded.session.preparation.units).toHaveLength(8);
    if (id === 'mouse-combat') {
      expect(loaded.mouseCombatPlaytest).toBe(true);
      expect(loaded.session.preparation.units).toHaveLength(2);
    }
  },
);

test('白名单拒绝未知目标或查询注入，不导航到正式档', () => {
  expect(new Set(playtestScenes.map((scene) => scene.id)).size).toBe(6);
  for (const id of ['', 'stage999', 'ranged8&case=setback', '../', 'toString'])
    expect(playtestUrl(id, true, '/')).toBeNull();
});

test('关闭诊断不带perf，重新构造地址不继承旧方案与hash', () => {
  const current = new URL(
    'https://example.test/game/?playtest=ranged8&case=setback&variant=candidate&perf=1#old',
  );
  expect(playtestUrl('stage50', false, current.pathname)).toBe('/game/?playtest=stage50');
});

test.each(playtestScenes)('$id操作后返回正式地址仍恢复原检查点，不带入试玩资源', async (entry) => {
  vi.resetModules();
  const { loadBrowserSession: load } = await import('./useSessionStorage');
  const campaign = new Session(20261027);
  expect(campaign.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  const saved = campaign.exportSave();
  const text = JSON.stringify(saved);
  const storage = {
    getItem: vi.fn((key: string) => (key === SAVE_KEY ? text : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const url = new URL(playtestUrl(entry.id, true, '/game/')!, 'https://example.test');
  const location = { search: url.search };
  vi.stubGlobal('window', { location, localStorage: storage });
  const trial = load();
  expect(trial.isolated).toBe(true);
  const before = trial.session.exportSave();
  const unit = trial.session.preparation.units[0];
  if (unit) expect(trial.session.discard(unit.id)).toBeNull();
  else expect(trial.session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  expect(trial.session.exportSave()).not.toEqual(before);
  expect(storage.getItem).not.toHaveBeenCalled();
  // The return button navigates to location.pathname, dropping every trial parameter.
  location.search = new URL(url.pathname, url).search;
  const restored = load();
  expect(restored.isolated).not.toBe(true);
  expect(restored.recovered).toBe(true);
  expect(restored.session.exportSave()).toEqual(saved);
  expect(storage.getItem(SAVE_KEY)).toBe(text);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});

test.each(['empty', 'unavailable'] as const)(
  '返回正式地址时%s存储沿用正常加载处理',
  async (mode) => {
    vi.resetModules();
    const { loadBrowserSession: load } = await import('./useSessionStorage');
    const location = { search: '?playtest=onboarding&perf=1' };
    const getItem = vi.fn(() => {
      if (mode === 'unavailable') throw Error('storage unavailable');
      return null;
    });
    vi.stubGlobal('window', { location, localStorage: { getItem } });
    expect(load().isolated).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
    location.search = '';
    const restored = load();
    expect(restored.isolated).not.toBe(true);
    expect(restored.blocked).toBe(mode === 'unavailable');
    expect(restored.recovered).toBe(false);
    expect(restored.session.preparation.stageId).toBe(1);
    expect(getItem).toHaveBeenCalledWith(SAVE_KEY);
  },
);
