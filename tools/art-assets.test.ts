import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { artManifest, battlefieldArt, type ArtKey } from '../src/render/art';
import { boarAttackArt, boarMotionArt } from '../src/render/character-art';

function webpDimensions(data: Buffer): [number, number] | undefined {
  expect(data.toString('ascii', 0, 4)).toBe('RIFF');
  expect(data.toString('ascii', 8, 12)).toBe('WEBP');
  for (let offset = 12; offset + 8 <= data.length; ) {
    const size = data.readUInt32LE(offset + 4);
    if (data.toString('ascii', offset, offset + 4) === 'VP8L') {
      expect(data[offset + 8]).toBe(0x2f);
      const bits = data.readUInt32LE(offset + 9);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    offset += 8 + size + (size % 2);
  }
}

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
  expect(webpDimensions(runtime)).toEqual([
    boarAttackArt.frameWidth * boarAttackArt.frames,
    boarAttackArt.frameHeight,
  ]);
});

it('岩甲豚三组新动作源图/归档/发布一致，固定画布比例原点，伏地保留体高降低', () => {
  const reports = JSON.parse(
    readFileSync('docs/img/animations/boar/prepared/motions-preparation.json', 'utf8'),
  );
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(reports.map((report: { action: string }) => report.action)).toEqual([
    'idle',
    'hurt',
    'fallen',
  ]);
  for (const report of reports) {
    const action = report.action as 'idle' | 'hurt' | 'fallen';
    const art = boarMotionArt[action];
    const raw = readFileSync(`docs/img/animations/boar/${action}-sheet-raw.png`);
    const archived = readFileSync(`docs/img/animations/boar/prepared/${action}.webp`);
    const runtime = readFileSync(`public/${art.file}`);
    expect(hash(raw)).toBe(report.sourceSha256);
    expect(runtime.equals(archived)).toBe(true);
    expect(hash(runtime)).toBe(report.outputSha256);
    expect(report.frameSize).toEqual([art.frameWidth, art.frameHeight]);
    expect(report.referenceBodySize).toEqual([art.width, art.height]);
    expect(report.originPixels).toEqual([
      art.originX * art.frameWidth,
      art.originY * art.frameHeight,
    ]);
    expect(report.frameCount).toBe(art.frames);
    expect(webpDimensions(runtime)).toEqual([art.frameWidth * art.frames, art.frameHeight]);
    expect(report.sharedScale).toBeGreaterThan(0);
    for (const frame of report.frames) {
      expect(frame.outputFootY).toBe(256);
      expect(frame.offset[0]).toBe(report.sharedOffsetX);
      const [left, top, right, bottom] = frame.outputBounds;
      expect(left).toBeGreaterThan(0);
      expect(top).toBeGreaterThan(0);
      expect(right).toBeLessThan(art.frameWidth);
      expect(bottom).toBeLessThan(art.frameHeight);
    }
    if (action === 'fallen') {
      const heights = report.frames.map(
        (frame: { outputBounds: number[] }) => frame.outputBounds[3] - frame.outputBounds[1],
      );
      for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThan(heights[i - 1]);
      expect(heights[4]).toBeLessThan(heights[0] * 0.75);
    }
  }
});
