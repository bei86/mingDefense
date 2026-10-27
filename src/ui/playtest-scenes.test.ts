import { afterEach, expect, test, vi } from 'vitest';
import { loadBrowserSession } from './useSessionStorage';
import { playtestScenes, playtestUrl } from './playtest-scenes';

afterEach(() => vi.unstubAllGlobals());

test.each(['onboarding', 'roster', 'ranged8', 'calibration40', 'stage50'])(
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
  },
);

test('白名单拒绝未知目标或查询注入，不导航到正式档', () => {
  expect(new Set(playtestScenes.map((scene) => scene.id)).size).toBe(5);
  for (const id of ['', 'stage999', 'ranged8&case=setback', '../', 'toString'])
    expect(playtestUrl(id, true, '/')).toBeNull();
});

test('关闭诊断不带perf，重新构造地址不继承旧方案与hash', () => {
  const current = new URL(
    'https://example.test/game/?playtest=ranged8&case=setback&variant=candidate&perf=1#old',
  );
  expect(playtestUrl('stage50', false, current.pathname)).toBe('/game/?playtest=stage50');
});
