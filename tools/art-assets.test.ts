import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artManifest, battlefieldArt, type ArtKey } from '../src/render/art';

describe('发布图片完整性', () => {
  it('清单中的每张图真实存在并为WebP，所有战场纹理可找到', () => {
    for (const key of battlefieldArt) expect(artManifest[key], key).toBeDefined();
    for (const key of Object.keys(artManifest) as ArtKey[]) {
      const entry = artManifest[key];
      const path = `public/assets/art/${entry.file}`;
      expect(existsSync(path), path).toBe(true);
      const data = readFileSync(path);
      expect(data.toString('ascii', 0, 4)).toBe('RIFF');
      expect(data.toString('ascii', 8, 12)).toBe('WEBP');
      expect(entry.width).toBeGreaterThan(0);
      expect(entry.height).toBeGreaterThan(0);
    }
  });
});
