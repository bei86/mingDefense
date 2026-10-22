import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { ArtLayer } from './ArtLayer';

describe('图片池回收与方向隔离', () => {
  it('下一帧复用图片时重置角度、透明度和色调；缺纹理不创建对象，多余对象隐藏', () => {
    const image = {
      setTexture: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setRotation: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
    };
    const scene = {
      textures: { exists: vi.fn().mockReturnValue(true) },
      add: { image: vi.fn().mockReturnValue(image) },
    };
    const layer = new ArtLayer(scene as unknown as Phaser.Scene);
    layer.begin();
    layer.draw('fx_fist', 1, 2, 30, 40, 8, 0.4, 0xffaabb, 1.5);
    layer.end();
    expect(layer.stats).toEqual({ active: 1, pooled: 1 });
    expect(image.setRotation).toHaveBeenLastCalledWith(1.5);
    layer.begin();
    layer.draw('boss_35_idle', 1, 2, 80, 88, 4);
    layer.end();
    expect(scene.add.image).toHaveBeenCalledTimes(1);
    expect(image.setRotation).toHaveBeenLastCalledWith(0);
    expect(image.setAlpha).toHaveBeenLastCalledWith(1);
    expect(image.setTint).toHaveBeenLastCalledWith(0xffffff);
    layer.begin();
    scene.textures.exists.mockReturnValue(false);
    expect(layer.draw('fx_fist', 0, 0, 20, 20, 8)).toBe(false);
    layer.end();
    expect(image.setVisible).toHaveBeenLastCalledWith(false);
    expect(layer.stats).toEqual({ active: 0, pooled: 1 });
    expect(scene.add.image).toHaveBeenCalledTimes(1);
  });
});
