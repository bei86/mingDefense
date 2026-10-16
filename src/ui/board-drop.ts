import type { Point } from '../game/content';
import { unitAt, type Preparation, type Source } from '../game/session';

export function boardDrop(
  preparation: Preparation,
  source: Source,
  pointer: Point,
  offset: Point = { x: 0, y: 0 },
): Point | { merge: number } {
  const target = unitAt(preparation, pointer);
  if (target && !(source.type === 'unit' && source.id === target.id)) return { merge: target.id };
  return { x: pointer.x - offset.x, y: pointer.y - offset.y };
}
