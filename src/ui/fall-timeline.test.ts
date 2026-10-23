import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import { clone } from '../game/content';
import { fallTimeline } from './fall-timeline';

describe('重伤时间线文本', () => {
  it('区分旧记录与已记录但无重伤', () => {
    const b = createCombat([]);
    expect(fallTimeline(b)).toEqual([]);
    delete b.report!.falls;
    expect(fallTimeline(b)).toBeNull();
    delete b.report;
    expect(fallTimeline(b)).toBeNull();
  });
  it('同种实例用阶数和锚点区分，同批并列，读取不改变战斗', () => {
    const b = createCombat([
      { id: 2, kind: 'ember_mouse', rank: 2, position: { x: 1, y: 3 } },
      { id: 1, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 3 } },
      { id: 3, kind: 'boar', rank: 1, position: null },
    ]);
    b.allies.forEach((u) => (u.hp = 0));
    b.report!.falls = [{ at: 12350, unitIds: [1, 2] }];
    const before = clone(b);
    expect(fallTimeline(b)).toEqual(['12.35 秒：烬灵鼠 1阶（3列4行）、烬灵鼠 2阶（2列4行）']);
    expect(b).toEqual(before);
  });
});
