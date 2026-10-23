import { describe, expect, it } from 'vitest';
import { captureFormation, type FormationPreset } from '../game/formation-presets';
import type { StoragePort } from '../game/persistence';
import {
  FORMATION_PRESETS_KEY,
  readFormationLibrary,
  writeFormationSlot,
} from './formation-preset-storage';

function memory(): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
const preset = captureFormation([
  { id: 5, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
]);

describe('独立阵型预设存储', () => {
  it('三槽跨读取保留，只写独立key，不修改战役及其他槽位，输入不共享引用', () => {
    const store = memory();
    store.data.set('ming-defense:campaign', 'untouched');
    expect(readFormationLibrary(store).slots).toEqual([null, null, null]);
    expect(writeFormationSlot(store, 0, preset).error).toBeNull();
    const another = structuredClone(preset);
    another.units[0].position!.x = 2;
    expect(writeFormationSlot(store, 2, another).error).toBeNull();
    const library = readFormationLibrary(store);
    expect(library.slots).toEqual([preset, null, another]);
    library.slots[0]!.units[0].rank = 6;
    expect(readFormationLibrary(store).slots[0]).toEqual(preset);
    expect(writeFormationSlot(store, 0, null).slots).toEqual([null, null, another]);
    expect(store.data.get('ming-defense:campaign')).toBe('untouched');
  });

  it.each([
    'bad json',
    'null',
    '{"schemaVersion":2,"slots":[null,null,null]}',
    '{"schemaVersion":1,"slots":[]}',
    ' '.repeat(32769),
  ])('损坏、未知版本、大小不合法保留原文并阻止覆盖 %#', (raw) => {
    const store = memory();
    store.data.set(FORMATION_PRESETS_KEY, raw);
    expect(readFormationLibrary(store).error).toBeTruthy();
    expect(writeFormationSlot(store, 0, preset).error).toBeTruthy();
    expect(store.data.get(FORMATION_PRESETS_KEY)).toBe(raw);
  });

  it.each([
    { units: [{ kind: 'not_hero', rank: 1, position: { x: 0, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 0, position: { x: 0, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 7, position: { x: 0, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 1, position: { x: 0.5, y: 0 } }] },
    { units: [{ kind: 'boar', rank: 1, position: { x: 5, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 1, position: null }] },
    { units: [...preset.units, ...preset.units] },
    { units: Array.from({ length: 39 }, () => preset.units[0]) },
  ])('无效单槽也阻止整个库被覆盖 %#', (bad) => {
    const store = memory();
    const raw = JSON.stringify({ schemaVersion: 1, slots: [bad, null, null] });
    store.data.set(FORMATION_PRESETS_KEY, raw);
    expect(writeFormationSlot(store, 1, preset).error).toBeTruthy();
    expect(store.data.get(FORMATION_PRESETS_KEY)).toBe(raw);
  });

  it('getItem失败不尝试写，配额失败不返回未保存的新槽，恢复后可以重试', () => {
    let writes = 0;
    const blocked: StoragePort = {
      getItem: () => {
        throw Error('blocked');
      },
      setItem: () => {
        writes++;
      },
      removeItem: () => {},
    };
    expect(writeFormationSlot(blocked, 0, preset).error).toBeTruthy();
    expect(writes).toBe(0);
    const store = memory();
    writeFormationSlot(store, 0, preset);
    const full = {
      ...store,
      setItem: () => {
        throw Error('quota');
      },
    };
    const failed = writeFormationSlot(full, 2, preset);
    expect(failed.error).toContain('保存失败');
    expect(failed.slots).toEqual([preset, null, null]);
    expect(writeFormationSlot(store, 2, preset).slots).toEqual([preset, null, preset]);
  });

  it('非法索引和写入形状拒绝，额外拥有权字段读取时丢弃', () => {
    const store = memory();
    for (const index of [-1, 3, 0.5, NaN])
      expect(writeFormationSlot(store, index, preset).error).toBeTruthy();
    expect(writeFormationSlot(store, 0, { units: [] } as FormationPreset).error).toBeTruthy();
    expect(store.data.size).toBe(0);
    store.data.set(
      FORMATION_PRESETS_KEY,
      JSON.stringify({
        schemaVersion: 1,
        slots: [{ units: [{ ...preset.units[0], id: 999, currency: 1000 }] }, null, null],
      }),
    );
    expect(readFormationLibrary(store).slots[0]).toEqual(preset);
    const extended = { units: [{ ...preset.units[0], id: 999, notes: 'x'.repeat(40000) }] };
    expect(writeFormationSlot(store, 1, extended).error).toBeNull();
    expect(readFormationLibrary(store).slots).toEqual([preset, preset, null]);
  });
});
