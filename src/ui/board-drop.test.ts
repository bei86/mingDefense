import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { Session } from '../game/session';
import { boardDrop } from './board-drop';

describe('多格灵兽拖动落点', () => {
  it.each([0, 1])('抓住横两格的第%s格向右平移，允许新旧占格重叠', (grabbedX) => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    const source = { type: 'unit' as const, id: s.preparation.units[0].id };
    const destination = boardDrop(
      s.preparation,
      source,
      { x: 3 + grabbedX, y: 3 },
      { x: grabbedX, y: 0 },
    );
    expect(s.transfer(source, destination)).toBeNull();
    expect(s.preparation.units[0].position).toEqual({ x: 3, y: 3 });
    expect(s.preparation.units[0].rank).toBe(1);
  });
  it('从2×2灵兽右下格抓取，向上平移一格并保留抓取偏移', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 4 }, { x: 2, y: 4 });
    const source = { type: 'unit' as const, id: s.preparation.units[0].id };
    expect(
      s.transfer(source, boardDrop(s.preparation, source, { x: 3, y: 4 }, { x: 1, y: 1 })),
    ).toBeNull();
    expect(s.preparation.units[0].position).toEqual({ x: 2, y: 3 });
  });
  it('按指针实际命中的同种同阶目标合成，不被抓取偏移错开', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 3 }, { x: 1, y: 3 });
    const source = { type: 'unit' as const, id: s.preparation.units[0].id };
    s.preparation.units.push({ id: 99, kind: 'boar', rank: 1, position: { x: 3, y: 3 } });
    const destination = boardDrop(s.preparation, source, { x: 3, y: 3 }, { x: 1, y: 0 });
    expect(s.transfer(source, destination)).toBeNull();
    expect(s.preparation.units).toEqual([
      { id: 99, kind: 'boar', rank: 2, position: { x: 3, y: 3 } },
    ]);
  });
  it('偏移后的占格越界或撞到其他灵兽时保持原状态', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    s.transfer({ type: 'offer', id: 1 }, { x: 4, y: 3 });
    const source = { type: 'unit' as const, id: s.preparation.units[0].id };
    const before = clone(s.preparation);
    for (const pointer of [
      { x: 3, y: 3 },
      { x: 5, y: 3 },
    ]) {
      expect(s.transfer(source, boardDrop(s.preparation, source, pointer))).toBeTruthy();
      expect(s.preparation).toEqual(before);
    }
  });
});
