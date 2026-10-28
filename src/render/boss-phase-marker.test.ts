import type Phaser from 'phaser';
import { expect, test, vi } from 'vitest';
import { drawBossPhaseMarker } from './boss-phase-marker';

function graphics() {
  return {
    lineStyle: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    strokeEllipse: vi.fn().mockReturnThis(),
    fillEllipse: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
  };
}

test('普通怪、第一阶段、倒下首领不绘制；只读二阶段标记复用既有图形层', () => {
  const ground = graphics();
  const overlay = graphics();
  const draw = (enemy: Parameters<typeof drawBossPhaseMarker>[2]) =>
    drawBossPhaseMarker(
      ground as unknown as Phaser.GameObjects.Graphics,
      overlay as unknown as Phaser.GameObjects.Graphics,
      enemy,
      { x: 154, y: 100 },
    );
  draw({ kind: 'wolf', phase2: true, hp: 100 });
  draw({ kind: 'boss', phase2: false, hp: 100 });
  draw({ kind: 'boss', hp: 100 });
  draw({ kind: 'boss', phase2: true, hp: 0 });
  expect(ground.lineStyle).not.toHaveBeenCalled();
  expect(overlay.fillStyle).not.toHaveBeenCalled();
  const enemy = Object.freeze({ kind: 'boss' as const, phase2: true, hp: 100 });
  draw(enemy);
  expect(ground.strokeEllipse).toHaveBeenCalledOnce();
  expect(overlay.strokeRoundedRect).toHaveBeenCalledOnce();
  expect(overlay.lineBetween).toHaveBeenCalledTimes(2);
  // No clock or animation input: repeat draws are stable when paused/reduced.
  const ring = ground.strokeEllipse.mock.calls[0];
  draw(enemy);
  expect(ground.strokeEllipse.mock.calls[1]).toEqual(ring);
  expect(enemy).toEqual({ kind: 'boss', phase2: true, hp: 100 });
});
