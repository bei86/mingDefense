import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { CombatNumber } from '../presentation/combat-numbers';
import { combatNumberLabel, CombatNumberLayer } from './CombatNumberLayer';

function fakeText() {
  return {
    text: '',
    width: 0,
    style: { color: '' },
    setText(value: string) {
      this.text = value;
      this.width = value.length * 10;
      return this;
    },
    setColor(value: string) {
      this.style.color = value;
      return this;
    },
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setResolution: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
}
function setup() {
  const scene = {
    add: { text: vi.fn(fakeText) },
    cameras: { main: { worldView: { x: 0, y: -120, right: 360, bottom: 416 } } },
  };
  return { scene, layer: new CombatNumberLayer(scene as unknown as Phaser.Scene) };
}
function number(id = 1): CombatNumber {
  return {
    id,
    actorId: id,
    team: 'enemy',
    kind: 'damage',
    amount: 75,
    point: { x: 2, y: 1 },
    born: 0,
  };
}

describe('战斗文字池', () => {
  it('整数和万单位显示，盾有独立前缀', () => {
    expect(combatNumberLabel({ kind: 'damage', amount: 0.1 })).toBe('-1');
    expect(combatNumberLabel({ kind: 'damage', amount: 9999 })).toBe('-9999');
    expect(combatNumberLabel({ kind: 'damage', amount: 12345 })).toBe('-1.2万');
    expect(combatNumberLabel({ kind: 'shield', amount: 45 })).toBe('盾 45');
  });

  it('任意数量输入也最多创建24个对象，清空隐藏，复用重置文本颜色及分辨率', () => {
    const { scene, layer } = setup();
    layer.draw(
      Array.from({ length: 40 }, (_, id) => number(id)),
      100,
      1,
      false,
    );
    expect(scene.add.text).toHaveBeenCalledTimes(24);
    expect(layer.stats).toEqual({ active: 24, pooled: 24 });
    const first = scene.add.text.mock.results[0].value;
    layer.draw([], 100, 1, false);
    expect(layer.stats).toEqual({ active: 0, pooled: 24 });
    expect(first.setVisible).toHaveBeenLastCalledWith(false);
    layer.draw([{ ...number(), team: 'ally', kind: 'shield', amount: 18 }], 100, 3, true);
    expect(scene.add.text).toHaveBeenCalledTimes(24);
    expect(first.text).toBe('盾 18');
    expect(first.style.color).toBe('#e1c5ff');
    expect(first.setResolution).toHaveBeenLastCalledWith(3);
    expect(first.setAlpha).toHaveBeenLastCalledWith(1);
    expect(first.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('减少动态效果时位置不变；正常上浮，左右夹紧，未来和过期文字不绘制', () => {
    const { scene, layer } = setup();
    const item = { ...number(), point: { x: -10, y: 1 } };
    layer.draw([item], 100, 2, true);
    const text = scene.add.text.mock.results[0].value;
    const position = text.setPosition.mock.lastCall;
    expect(position![0]).toBeGreaterThanOrEqual(text.width / 2 + 6);
    layer.draw([item], 400, 2, true);
    expect(text.setPosition).toHaveBeenLastCalledWith(...position!);
    layer.draw([item], 400, 2, false);
    expect(text.setPosition.mock.lastCall![1]).toBeLessThan(position![1]);
    layer.draw([{ ...item, point: { x: 20, y: 1 } }], 400, 2, false);
    expect(text.setPosition.mock.lastCall![0]).toBeLessThanOrEqual(354 - text.width / 2);
    layer.draw([item], 700, 2, false);
    expect(layer.stats.active).toBe(0);
    layer.draw([item], -1, 2, false);
    expect(layer.stats.active).toBe(0);
  });

  it('同一目标的连续两条伤害在正常动效中至少间隔22像素', () => {
    const { scene, layer } = setup();
    const first = number(1);
    const second = { ...number(2), actorId: 1, born: 200 };
    layer.draw([first, second], 300, 1, false);
    const older = scene.add.text.mock.results[0].value;
    const newer = scene.add.text.mock.results[1].value;
    expect(
      newer.setPosition.mock.lastCall![1] - older.setPosition.mock.lastCall![1],
    ).toBeGreaterThanOrEqual(22);
  });
});
