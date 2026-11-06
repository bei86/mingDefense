import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { artManifest, battlefieldArt, type ArtKey } from '../src/render/art';
import { boarAttackArt } from '../src/render/character-art';

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

it('岩甲豚六帧发布图与处理记录一致，尺寸满足Phaser分帧且原始文件未变', () => {
  const report = JSON.parse(
    readFileSync('docs/img/animations/boar/prepared/preparation.json', 'utf8'),
  );
  const raw = readFileSync('docs/img/animations/boar/attack-sheet-raw.png');
  const prepared = readFileSync('docs/img/animations/boar/prepared/attack.webp');
  const runtime = readFileSync(`public/${boarAttackArt.file}`);
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(hash(raw)).toBe(report.sourceSha256);
  expect(hash(runtime)).toBe(report.outputSha256);
  expect(runtime.equals(prepared)).toBe(true);
  expect(report.frameSize).toEqual([boarAttackArt.frameWidth, boarAttackArt.frameHeight]);
  expect(report.referenceBodySize).toEqual([boarAttackArt.width, boarAttackArt.height]);
  expect(report.originPixels).toEqual([
    boarAttackArt.originX * boarAttackArt.frameWidth,
    boarAttackArt.originY * boarAttackArt.frameHeight,
  ]);
  expect(report.frames).toHaveLength(boarAttackArt.frames);
  expect(report.frames.every((frame: { outputFootY: number }) => frame.outputFootY === 256)).toBe(
    true,
  );
  expect(runtime.toString('ascii', 0, 4)).toBe('RIFF');
  expect(runtime.toString('ascii', 8, 12)).toBe('WEBP');
  let dimensions: [number, number] | undefined;
  for (let offset = 12; offset + 8 <= runtime.length; ) {
    const size = runtime.readUInt32LE(offset + 4);
    if (runtime.toString('ascii', offset, offset + 4) === 'VP8L') {
      expect(runtime[offset + 8]).toBe(0x2f);
      const bits = runtime.readUInt32LE(offset + 9);
      dimensions = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
      break;
    }
    offset += 8 + size + (size % 2);
  }
  expect(dimensions).toEqual([
    boarAttackArt.frameWidth * boarAttackArt.frames,
    boarAttackArt.frameHeight,
  ]);
});
