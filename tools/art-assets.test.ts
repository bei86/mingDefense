import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { artManifest, battlefieldArt, type ArtKey } from '../src/render/art';
import {
  boarAttackArt,
  boarMotionArt,
  swordEagleAttackArt,
  swordEagleMotionArt,
} from '../src/render/character-art';

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

it('青锋隼跨格翼尖完整保留，发布图/归档/源哈希一致，整组共用悬空落点', () => {
  const directory = 'docs/img/animations/sword_eagle';
  const report = JSON.parse(readFileSync(`${directory}/prepared/preparation.json`, 'utf8'));
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  const runtime = readFileSync(`public/${swordEagleAttackArt.file}`);
  expect(hash(readFileSync(`${directory}/attack-sheet-raw.png`))).toBe(report.sourceSha256);
  expect(hash(runtime)).toBe(report.outputSha256);
  expect(runtime.equals(readFileSync(`${directory}/prepared/attack.webp`))).toBe(true);
  expect(report.published).toBe(true);
  expect(report.frameSize).toEqual([
    swordEagleAttackArt.frameWidth,
    swordEagleAttackArt.frameHeight,
  ]);
  expect(report.referenceBodySize).toEqual([swordEagleAttackArt.width, swordEagleAttackArt.height]);
  expect(report.originPixels).toEqual([
    swordEagleAttackArt.originX * swordEagleAttackArt.frameWidth,
    swordEagleAttackArt.originY * swordEagleAttackArt.frameHeight,
  ]);
  expect(webpDimensions(runtime)).toEqual([448 * 6, 352]);
  expect(report.sharedScale).toBe(0.625);
  expect(report.frames).toHaveLength(6);
  // Fourth wing passes the nominal cut; frame five starts after its complete silhouette.
  expect(report.frames[3].sourceRegion).toEqual([0, 512, 567, 1024]);
  expect(report.frames[3].sourceBounds[2]).toBeGreaterThan(512);
  for (const frame of report.frames) {
    expect(Math.abs(frame.alignedBodyPoint[0] - report.bodyAnchorPixels[0])).toBeLessThanOrEqual(
      0.5,
    );
    expect(Math.abs(frame.alignedBodyPoint[1] - report.bodyAnchorPixels[1])).toBeLessThanOrEqual(
      0.5,
    );
    const [left, top, right, bottom] = frame.outputBounds;
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
    expect(right).toBeLessThan(448);
    expect(bottom).toBeLessThan(352);
  }
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

it('鹰三组动作原图/归档/发布一致，跨格羽毛保留、悬停稳定且降落不被逐帧抬回', () => {
  const directory = 'docs/img/animations/sword_eagle';
  const reports = JSON.parse(
    readFileSync(`${directory}/prepared/motions-preparation.json`, 'utf8'),
  );
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(reports.map((report: { action: string }) => report.action)).toEqual([
    'idle',
    'hurt',
    'fallen',
  ]);
  for (const report of reports) {
    const action = report.action as 'idle' | 'hurt' | 'fallen';
    const art = swordEagleMotionArt[action];
    const runtime = readFileSync(`public/${art.file}`);
    expect(hash(readFileSync(`${directory}/${action}-sheet-raw.png`))).toBe(report.sourceSha256);
    expect(runtime.equals(readFileSync(`${directory}/prepared/${action}.webp`))).toBe(true);
    expect(hash(runtime)).toBe(report.outputSha256);
    expect(report.published).toBe(true);
    expect(report.frameCount).toBe(art.frames);
    expect(report.frameSize).toEqual([art.frameWidth, art.frameHeight]);
    expect(report.referenceBodySize).toEqual([art.width, art.height]);
    expect(report.originPixels).toEqual([
      art.originX * art.frameWidth,
      art.originY * art.frameHeight,
    ]);
    expect(webpDimensions(runtime)).toEqual([art.frameWidth * art.frames, art.frameHeight]);
    const scale = Math.min(94 / art.width, 88 / art.height);
    for (const frame of report.frames) {
      const [left, top, right, bottom] = frame.outputBounds;
      expect(left).toBeGreaterThan(0);
      expect(top).toBeGreaterThan(0);
      expect(right).toBeLessThan(art.frameWidth);
      expect(bottom).toBeLessThan(art.frameHeight);
      // Entire motion fits the same actual 2x2 draw area, not only the exported canvas.
      expect(Math.max(Math.abs(left - 240), Math.abs(right - 240)) * scale).toBeLessThanOrEqual(47);
      expect(Math.max(Math.abs(top - 180), Math.abs(bottom - 180)) * scale).toBeLessThanOrEqual(44);
      expect(Math.abs(frame.outputBodyPoint[0] - 240)).toBeLessThanOrEqual(0.5);
      if (action !== 'fallen')
        expect(Math.abs(frame.outputBodyPoint[1] - 224)).toBeLessThanOrEqual(0.5);
    }
    if (action === 'fallen') {
      expect(report.frames[0].sourceBounds[2]).toBeGreaterThan(355);
      expect(report.frames[1].sourceRegion).toEqual([432, 0, 775, 887]);
      expect(
        new Set(report.frames.map((frame: { offset: number[] }) => frame.offset[1])).size,
      ).toBe(1);
      for (let i = 1; i < report.frames.length; i++) {
        expect(report.frames[i].outputBodyPoint[1]).toBeGreaterThan(
          report.frames[i - 1].outputBodyPoint[1],
        );
      }
      expect(
        Math.abs(report.frames[4].outputBounds[3] - report.frames[3].outputBounds[3]),
      ).toBeLessThanOrEqual(1);
    }
  }
});

it('鹰下载文件命名可追溯，原图字节未变，旧攻击下载副本与已接入原图一致', () => {
  const directory = 'docs/img/animations/sword_eagle';
  const names = JSON.parse(readFileSync(`${directory}/source-names.json`, 'utf8'));
  expect(names).toHaveLength(4);
  for (const entry of names) {
    const raw = readFileSync(`${directory}/${entry.savedName}`);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(entry.sha256);
    expect(existsSync(`${directory}/${entry.downloadName}`)).toBe(false);
  }
  expect(
    readFileSync(`${directory}/attack-sheet-download-original.png`).equals(
      readFileSync(`${directory}/attack-sheet-raw.png`),
    ),
  ).toBe(true);
});
