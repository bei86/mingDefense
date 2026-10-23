import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { captureFormation } from '../game/formation-presets';
import { useFormationPresets } from './useFormationPresets';
import { FORMATION_PRESETS_KEY } from './formation-preset-storage';

afterEach(() => vi.unstubAllGlobals());

it('开发隔离的初始化、暂存、删除、重读均不访问正式预设存储', () => {
  const getItem = vi.fn(() => {
    throw Error('must not read');
  });
  const setItem = vi.fn(() => {
    throw Error('must not write');
  });
  vi.stubGlobal('window', { localStorage: { getItem, setItem } });
  let controller: ReturnType<typeof useFormationPresets>;
  function Probe() {
    controller = useFormationPresets(true);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  const preset = captureFormation([
    { id: 5, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
  ]);
  expect(controller!.slots).toEqual([null, null, null]);
  expect(controller!.update(0, preset)).toBeNull();
  expect(controller!.update(0, null)).toBeNull();
  controller!.reload();
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

it('正常初始化读取浏览器预设，更新只写单独预设key', () => {
  const data = new Map<string, string>();
  const getItem = vi.fn((key: string) => data.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string) => {
    data.set(key, value);
  });
  vi.stubGlobal('window', { localStorage: { getItem, setItem } });
  let controller: ReturnType<typeof useFormationPresets>;
  function Probe() {
    controller = useFormationPresets(false);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  const preset = captureFormation([
    { id: 5, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
  ]);
  expect(controller!.update(1, preset)).toBeNull();
  expect([...data.keys()]).toEqual([FORMATION_PRESETS_KEY]);
  renderToStaticMarkup(createElement(Probe));
  expect(controller!.slots).toEqual([null, preset, null]);
});
