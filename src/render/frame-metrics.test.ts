import { describe, expect, it } from 'vitest';
import { FrameMetrics } from './frame-metrics';

describe('有界渲染帧观测', () => {
  it('只使用帧间隔，60Hz窗口输出均值与P95', () => {
    const metrics = new FrameMetrics();
    expect(metrics.snapshot()).toBeNull();
    for (let i = 0; i <= 60; i++) metrics.record((i * 1000) / 60);
    expect(metrics.snapshot()).toMatchObject({ frames: 60, slowPercent: 0 });
    expect(metrics.snapshot()!.fps).toBeCloseTo(60);
    expect(metrics.snapshot()!.p95Ms).toBeCloseTo(1000 / 60);
  });
  it('慢帧纳入统计；只保留最新120帧，长期运行不积累样本', () => {
    const metrics = new FrameMetrics();
    metrics.record(0);
    for (let i = 1; i <= 10; i++) metrics.record(i * 100);
    expect(metrics.snapshot()).toMatchObject({ frames: 10, fps: 10, p95Ms: 100, slowPercent: 100 });
    for (let i = 1; i <= 240; i++) metrics.record(1000 + i * 20);
    expect(metrics.snapshot()).toMatchObject({ frames: 120, fps: 50, p95Ms: 20, slowPercent: 0 });
  });
  it('可见页面的长间隔计入慢帧；离屏显式重置和时钟回退清空旧窗口', () => {
    const metrics = new FrameMetrics();
    [0, 20, 40, 1000].forEach((now) => metrics.record(now));
    expect(metrics.snapshot()!.slowPercent).toBeCloseTo(100 / 3);
    metrics.reset();
    expect(metrics.snapshot()).toBeNull();
    metrics.record(1000);
    metrics.record(1020);
    expect(metrics.snapshot()!.fps).toBe(50);
    metrics.record(10);
    expect(metrics.snapshot()).toBeNull();
    metrics.record(30);
    expect(metrics.snapshot()!.frames).toBe(1);
    metrics.reset();
    expect(metrics.snapshot()).toBeNull();
  });
  it('忽略同时间戳，非法输入重置，后续有效帧可以恢复', () => {
    const metrics = new FrameMetrics();
    [0, 0, 20, 20].forEach((now) => metrics.record(now));
    expect(metrics.snapshot()!.frames).toBe(1);
    metrics.record(Number.NaN);
    expect(metrics.snapshot()).toBeNull();
    metrics.record(40);
    metrics.record(60);
    expect(metrics.snapshot()!.fps).toBe(50);
  });
  it('绘制CPU耗时与浏览器帧间隔独立统计，包含卡顿而不暗示GPU耗时', () => {
    const metrics = new FrameMetrics();
    metrics.record(0);
    metrics.record(20, 2);
    metrics.record(100, 8);
    expect(metrics.snapshot()).toMatchObject({ frames: 2, fps: 20, drawMeanMs: 5, drawP95Ms: 8 });
  });
});
