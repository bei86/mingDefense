import { describe, expect, it } from 'vitest';
import { enemyDefinitions, stages } from '../game/content';
import { artManifest, battlefieldArt, bossArtKey, enemyArt } from './art';

describe('实际发布图片与关卡映射', () => {
  it('所有普通敌人与八位首领均有图；预加载覆盖两阶段，排除身份不一致变体', () => {
    for (const kind of Object.keys(enemyDefinitions)) {
      if (kind === 'boss') continue;
      const asset = enemyArt[kind as keyof typeof enemyArt];
      expect(asset, kind).toBeDefined();
      expect(battlefieldArt).toContain(asset);
    }
    for (const stage of stages.filter((entry) => entry.bossId && entry.id <= 40)) {
      for (const phase2 of [false, true]) {
        expect(bossArtKey(stage.id, phase2)).toBeDefined();
        expect(battlefieldArt).toContain(bossArtKey(stage.id, phase2));
      }
    }
    expect(bossArtKey(25, true)).toBe('boss_25_phase2');
    expect(bossArtKey(35, true)).toBe('boss_35_phase2');
    for (const stage of [5, 10, 15, 20, 30, 40])
      expect(bossArtKey(stage, true)).toBe(bossArtKey(stage));
    expect(bossArtKey(30)).toBe('boss_30_idle');
    expect(Object.keys(artManifest).some((key) => key.includes('variant'))).toBe(false);
    expect(bossArtKey(1)).toBeUndefined();
    // New boss uses its own procedural silhouette until art is provided.
    expect(bossArtKey(45)).toBeUndefined();
  });
});
