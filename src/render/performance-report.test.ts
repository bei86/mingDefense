import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Session } from '../game/session';
import { createCombat } from '../game/combat';
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from '../presentation/display-options';
import {
  performanceContext,
  performanceReport,
  PerformanceWindow,
  type PerformanceSample,
} from './performance-report';
import { PerformanceReport } from './PerformanceReport';

function sample(): PerformanceSample {
  return {
    capturedAt: '2026-10-26T06:30:00.000Z',
    contentVersion: 'prototype-2026-10-22-v24',
    context: {
      stage: 40,
      phase: 'combat',
      paused: false,
      choosing: false,
      speed: 2,
      display: { numbers: true, motion: 'system', systemReduced: false, reducedMotion: false },
    },
    gameTimeMs: 12350,
    summary: { frames: 120, fps: 50, p95Ms: 25, slowPercent: 5, drawMeanMs: 1, drawP95Ms: 2 },
    scene: {
      enemies: 16,
      flashes: 8,
      imagesActive: 43,
      imagesPooled: 61,
      numbersActive: 5,
      numbersPooled: 12,
      canvasWidth: 720,
      canvasHeight: 960,
      density: 2,
    },
    viewport: { width: 390, height: 844, dpr: 3 },
  };
}

describe('手机试玩性能诊断', () => {
  function context(session: Session) {
    return performanceContext(session, DEFAULT_DISPLAY_OPTIONS, false);
  }

  it.each([
    ['system', false, false],
    ['reduced', false, true],
    ['system', true, true],
    ['reduced', true, true],
  ] as const)(
    '报告准确区分用户%s/系统%s和有效动态%s，快照不共享输入',
    (motion, systemReduced, reducedMotion) => {
      const session = new Session();
      const before = session.exportSave();
      const options: DisplayOptions = { numbers: false, motion };
      const state = performanceContext(session, options, systemReduced);
      expect(state.display).toEqual({ numbers: false, motion, systemReduced, reducedMotion });
      expect(session.exportSave()).toEqual(before);
      options.numbers = true;
      expect(state.display.numbers).toBe(false);
      const input = sample();
      input.context = state;
      const report = performanceReport(input, 'Browser');
      expect(report.text).toContain('伤害飘字：关闭');
      expect(report.text).toContain(
        `角色动态选项：${motion === 'system' ? '跟随系统' : '减少动态'}`,
      );
      expect(report.text).toContain(`系统减少动态：${systemReduced ? '开启' : '关闭'}`);
      expect(report.text).toContain(`实际角色动态：${reducedMotion ? '减少动态' : '常规动态'}`);
      state.display.numbers = true;
      state.display.reducedMotion = !reducedMotion;
      expect(report.text).toContain('伤害飘字：关闭');
      expect(report.text).toContain(`实际角色动态：${reducedMotion ? '减少动态' : '常规动态'}`);
    },
  );

  it('飘字、用户选项和系统来源变化分别隔离窗口，不拼入旧设置帧间隔', () => {
    const session = new Session();
    const states = [
      performanceContext(session, { numbers: true, motion: 'system' }, false),
      performanceContext(session, { numbers: false, motion: 'system' }, false),
      performanceContext(session, { numbers: false, motion: 'reduced' }, false),
      performanceContext(session, { numbers: false, motion: 'reduced' }, true),
      performanceContext(session, { numbers: false, motion: 'system' }, true),
    ];
    const keys = states.map((state) => JSON.stringify(state));
    expect(new Set(keys).size).toBe(5);
    const window = new PerformanceWindow();
    keys.forEach((key, i) => {
      expect(window.snapshot(key)).toBeNull();
      window.record(i * 1000, 1, key);
      expect(window.snapshot(key)).toBeNull();
      window.record(i * 1000 + 20, 2, key);
      expect(window.snapshot(key)).toMatchObject({ frames: 1, fps: 50 });
    });
  });
  it('无帧不伪造报告，状态切换后的首帧不跨窗口计算', () => {
    const window = new PerformanceWindow();
    expect(window.snapshot('prepare')).toBeNull();
    window.record(0, 1, 'prepare');
    window.record(20, 2, 'prepare');
    expect(window.snapshot('prepare')!.fps).toBe(50);
    expect(window.snapshot('combat')).toBeNull();
    window.record(500, 2, 'combat');
    expect(window.snapshot('combat')).toBeNull();
    window.record(525, 3, 'combat');
    expect(window.snapshot('combat')).toMatchObject({ frames: 1, fps: 40, drawMeanMs: 3 });
  });

  it('重采样/隐藏后旧数据失效，真实卡顿保留且最多120帧', () => {
    const window = new PerformanceWindow();
    [0, 20, 1000].forEach((now) => window.record(now, 1, 'combat'));
    expect(window.snapshot('combat')!.slowPercent).toBe(50);
    for (let i = 1; i <= 240; i++) window.record(1000 + i * 20, 1, 'combat');
    expect(window.snapshot('combat')).toMatchObject({ frames: 120, fps: 50, slowPercent: 0 });
    window.reset();
    expect(window.snapshot('combat')).toBeNull();
    window.record(10000, 1, 'combat');
    expect(window.snapshot('combat')).toBeNull();
    window.record(10020, 1, 'combat');
    expect(window.snapshot('combat')!.frames).toBe(1);
  });

  it('关卡/阶段/暂停/天赋选择/倍速各自改变窗口上下文，读取不改Session', () => {
    const session = new Session();
    const before = session.exportSave();
    const initial = context(session);
    expect(context(session)).toEqual(initial);
    expect(session.exportSave()).toEqual(before);
    const keys = new Set([JSON.stringify(initial)]);
    session.preparation.stageId++;
    keys.add(JSON.stringify(context(session)));
    session.phase = 'combat';
    keys.add(JSON.stringify(context(session)));
    session.paused = true;
    keys.add(JSON.stringify(context(session)));
    session.speed = 2;
    keys.add(JSON.stringify(context(session)));
    session.battle = createCombat([]);
    session.battle.choices = ['attack'];
    keys.add(JSON.stringify(context(session)));
    expect(keys.size).toBe(6);
    expect(context(session)).toMatchObject({ stage: 2, paused: true, speed: 2 });
    expect(context(session).choosing).toBe(true);
    const window = new PerformanceWindow();
    for (const key of keys) {
      window.record(100, 1, key);
      expect(window.snapshot(key)).toBeNull();
      window.record(120, 1, key);
      expect(window.snapshot(key)!.frames).toBe(1);
    }
  });

  it('报告明确采样范围、上下文与设备，按字段输出且不写原快照', () => {
    const input = sample();
    const before = structuredClone(input);
    const result = performanceReport(input, 'Test Browser\nInjected\rUA');
    expect(input).toEqual(before);
    expect(result.fileName).toBe('ming-defense-performance-stage-40.md');
    for (const value of [
      '2026-10-26T06:30:00.000Z',
      'prototype-2026-10-22-v24',
      '第40关 · 守卫中 · 2倍',
      '游戏内时间：12.35秒',
      '120帧',
      '50.0 FPS',
      'P95帧间隔：25.0 ms',
      '慢帧（>50ms）：5.0%',
      '均值1.0 / P95 2.0 ms',
      '敌人16 · 攻击特效8',
      '图片43 / 池61',
      '飘字5 / 池12',
      '伤害飘字：开启',
      '角色动态选项：跟随系统',
      '系统减少动态：关闭',
      '实际角色动态：常规动态',
      '720×960 · 2倍采样',
      '390×844 · DPR 3',
      'Test Browser Injected UA',
      '不是整局平均',
      '不含GPU',
      '不能据此认定真机',
      '不会自动上传',
    ])
      expect(result.text).toContain(value);
    for (const forbidden of ['http:', 'https:', 'rng', 'currency', 'localStorage', 'seed'])
      expect(result.text).not.toContain(forbidden);
  });

  it('捕获是固定文本，暂停/天赋/无战斗时间明确且UA有界', () => {
    const input = sample();
    const first = performanceReport(input, 'Browser');
    input.summary.fps = 1;
    expect(first.text).toContain('50.0 FPS');
    input.context.paused = true;
    input.context.choosing = true;
    input.gameTimeMs = null;
    const next = performanceReport(input, 'A'.repeat(1000));
    expect(next.text).toContain('已暂停');
    expect(next.text).toContain('选择天赋');
    expect(next.text).toContain('游戏内时间：未开战');
    expect(next.text).not.toContain('A'.repeat(301));
  });

  it('初始UI只提供主动捕获，不生成文本、不自行调用采样或改游戏', () => {
    const html = renderToStaticMarkup(
      createElement(PerformanceReport, {
        readSample: () => {
          throw new Error('渲染时不得捕获');
        },
        onReset: () => {
          throw new Error('渲染时不得重置');
        },
      }),
    );
    expect(html).toContain('捕获诊断报告');
    expect(html).toContain('重新采样');
    expect(html).not.toContain('<textarea');
  });
});
