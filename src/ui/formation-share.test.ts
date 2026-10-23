import { describe, expect, it } from 'vitest';
import { captureFormation, type FormationPreset } from '../game/formation-presets';
import { Session } from '../game/session';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import type { StoragePort } from '../game/persistence';
import { createFormationShare, inspectFormationShare } from './formation-share';
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
  { id: 20, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
  { id: 10, kind: 'ember_mouse', rank: 1, position: null },
]);
function code(
  formation: unknown,
  version: unknown = 1,
  format: unknown = 'ming-defense-formation',
) {
  return JSON.stringify({ format, version, formation });
}

describe('单套阵型分享', () => {
  it('八灵多格与备战往返，序列不重排，输入不变且输出不共享引用', () => {
    const s = rosterPlaytest();
    s.preparation.units[0].position = null;
    const original = captureFormation(s.preparation.units);
    const before = JSON.stringify(s);
    const result = inspectFormationShare(createFormationShare(original));
    expect(result).toEqual({ ok: true, preset: original });
    expect(JSON.stringify(s)).toBe(before);
    expect(inspectFormationShare(createFormationShare(preset))).toEqual({ ok: true, preset });
    if (!result.ok) throw Error('Expected success');
    result.preset.units[1].position!.x = 99;
    expect(original.units[1].position!.x).not.toBe(99);
    expect(inspectFormationShare(createFormationShare(original))).toEqual({
      ok: true,
      preset: original,
    });
  });

  it('只保留站位字段，ID、解锁、天赋、资源和附加内容不进入分享', () => {
    const extended = {
      units: preset.units.map((u) => ({
        ...u,
        id: 999,
        currency: 10000,
        position: u.position && { ...u.position, secret: 'ignored' },
      })),
      unlocked: ['all'],
      progression: { level: 99 },
    };
    expect(JSON.parse(createFormationShare(extended))).toEqual(JSON.parse(code(preset)));
    expect(inspectFormationShare(code(extended))).toEqual({ ok: true, preset });
    expect(createFormationShare(extended)).not.toMatch(/999|currency|secret|progression|unlocked/);
  });

  it.each([
    '',
    'bad json',
    'null',
    '[]',
    '{}',
    JSON.stringify(preset),
    code(preset, 2),
    code(preset, '1'),
    code(preset, 1, 'another-game'),
  ])('拒绝无效文本和其他格式或版本 %#', (text) => {
    expect(inspectFormationShare(text).ok).toBe(false);
  });

  it.each([
    { units: [] },
    { units: [{ kind: 'unknown', rank: 1, position: { x: 0, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 7, position: { x: 0, y: 0 } }] },
    { units: [{ kind: 'ember_mouse', rank: 1, position: { x: 0.5, y: 0 } }] },
    { units: [{ kind: 'boar', rank: 1, position: { x: 5, y: 0 } }] },
    { units: [{ kind: 'sword_eagle', rank: 1, position: { x: 0, y: 5 } }] },
    { units: [preset.units[0]] },
    { units: [preset.units[1], preset.units[1]] },
    { units: [preset.units[1], preset.units[0], preset.units[0], preset.units[0]] },
    { units: Array.from({ length: 39 }, () => preset.units[1]) },
  ])('复用完整合法占格校验，不允许部分导入 %#', (bad) => {
    expect(inspectFormationShare(code(bad)).ok).toBe(false);
    expect(() => createFormationShare(bad as FormationPreset)).toThrow();
  });

  it('合法36格与2备战的最大阵型可往返', () => {
    const maximum: FormationPreset = {
      units: Array.from({ length: 36 }, (_, i) => ({
        kind: 'ember_mouse',
        rank: 6,
        position: { x: i % 6, y: Math.floor(i / 6) },
      })),
    };
    maximum.units.push(
      { kind: 'boar', rank: 1, position: null },
      { kind: 'sword_eagle', rank: 6, position: null },
    );
    const text = createFormationShare(maximum);
    expect(new TextEncoder().encode(text).length).toBeLessThan(8192);
    expect(inspectFormationShare(text)).toEqual({ ok: true, preset: maximum });
  });

  it('8KiB上限按UTF-8字节，校验前拒绝过大文本，边界可用', () => {
    const raw = code(preset);
    const boundary = raw.padEnd(8192, ' ');
    expect(inspectFormationShare(boundary).ok).toBe(true);
    expect(inspectFormationShare(boundary + ' ').ok).toBe(false);
    const unicode = code({ ...preset, note: '桃'.repeat(2800) });
    expect(unicode.length).toBeLessThan(8192);
    expect(inspectFormationShare(unicode).ok).toBe(false);
  });

  it('校验不读写存储；明确保存只改所选槽，Session完整保留，应用仍校验阵容', () => {
    const s = new Session();
    const before = JSON.stringify(s);
    const store = memory();
    store.data.set('ming-defense:campaign', before);
    writeFormationSlot(store, 0, preset);
    const snapshot = JSON.stringify([...store.data]);
    const result = inspectFormationShare(
      createFormationShare(captureFormation(rosterPlaytest().preparation.units)),
    );
    expect(JSON.stringify([...store.data])).toBe(snapshot);
    if (!result.ok) throw Error('Expected success');
    expect(writeFormationSlot(store, 2, result.preset).error).toBeNull();
    expect(readFormationLibrary(store).slots).toEqual([preset, null, result.preset]);
    expect(s.applyFormation(result.preset)).toBeTruthy();
    expect(JSON.stringify(s)).toBe(before);
    expect(store.data.get('ming-defense:campaign')).toBe(before);
    expect([...store.data.keys()].sort()).toEqual(
      ['ming-defense:campaign', FORMATION_PRESETS_KEY].sort(),
    );
  });

  it('坏库与配额失败不覆盖原文，正常时重新读取保留其他槽最新值', () => {
    const store = memory();
    store.data.set(FORMATION_PRESETS_KEY, 'broken');
    const result = inspectFormationShare(createFormationShare(preset));
    if (!result.ok) throw Error('Expected success');
    expect(writeFormationSlot(store, 0, result.preset).error).toBeTruthy();
    expect(store.data.get(FORMATION_PRESETS_KEY)).toBe('broken');
    store.data.delete(FORMATION_PRESETS_KEY);
    writeFormationSlot(store, 1, preset);
    const raw = store.data.get(FORMATION_PRESETS_KEY);
    expect(
      writeFormationSlot(
        {
          ...store,
          setItem: () => {
            throw Error('quota');
          },
        },
        0,
        result.preset,
      ).error,
    ).toBeTruthy();
    expect(store.data.get(FORMATION_PRESETS_KEY)).toBe(raw);
    expect(writeFormationSlot(store, 0, result.preset).slots).toEqual([preset, preset, null]);
  });
});
