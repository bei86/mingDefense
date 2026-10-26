import type { Session, Phase } from '../game/session';
import { FrameMetrics, type FrameSummary } from './frame-metrics';

export type PerformanceContext = {
  stage: number;
  phase: Phase;
  paused: boolean;
  choosing: boolean;
  speed: 1 | 2;
};

export function performanceContext(session: Session): PerformanceContext {
  return {
    stage: session.preparation.stageId,
    phase: session.phase,
    paused: session.paused,
    choosing: session.hasChoices,
    speed: session.speed,
  };
}

/** Keep preparation, battle, pause, choice and speed intervals in separate windows. */
export class PerformanceWindow {
  private metrics = new FrameMetrics();
  private context: string | null = null;

  reset(): void {
    this.metrics.reset();
    this.context = null;
  }

  record(now: number, drawMs: number, context: string): void {
    if (context !== this.context) {
      this.metrics.reset();
      this.context = context;
    }
    this.metrics.record(now, drawMs);
  }

  snapshot(context: string): FrameSummary | null {
    if (context !== this.context) return null;
    return this.metrics.snapshot();
  }
}

export type PerformanceSample = {
  capturedAt: string;
  contentVersion: string;
  context: PerformanceContext;
  gameTimeMs: number | null;
  summary: FrameSummary;
  scene: {
    enemies: number;
    flashes: number;
    imagesActive: number;
    imagesPooled: number;
    numbersActive: number;
    numbersPooled: number;
    canvasWidth: number;
    canvasHeight: number;
    density: number;
  };
  viewport: { width: number; height: number; dpr: number };
};

export type PerformanceDocument = { text: string; fileName: string };

export function performanceReport(
  sample: PerformanceSample,
  userAgent: string,
): PerformanceDocument {
  const { summary, context, scene, viewport } = sample;
  const phases: Record<Phase, string> = {
    prepare: '整备',
    combat: '守卫中',
    victory: '已守住',
    defeat: '未守住',
  };
  const state = [
    `第${context.stage}关`,
    phases[context.phase],
    `${context.speed}倍`,
    ...(context.paused ? ['已暂停'] : []),
    ...(context.choosing ? ['选择天赋'] : []),
  ].join(' · ');
  const browser = userAgent.replace(/[\r\n\t]+/g, ' ').slice(0, 300) || '未提供';
  return {
    fileName: `ming-defense-performance-stage-${context.stage}.md`,
    text: [
      '# 灵林守阵 · 手机试玩诊断',
      '',
      `采样时间（UTC）：${sample.capturedAt}`,
      `内容版本：${sample.contentVersion}`,
      `状态：${state}`,
      `游戏内时间：${sample.gameTimeMs === null ? '未开战' : `${(sample.gameTimeMs / 1000).toFixed(2)}秒`}`,
      '',
      '## 最近采样窗口',
      '',
      `帧数：${summary.frames}帧（最多120帧，不是整局平均）`,
      `平均帧率：${summary.fps.toFixed(1)} FPS`,
      `P95帧间隔：${summary.p95Ms.toFixed(1)} ms`,
      `慢帧（>50ms）：${summary.slowPercent.toFixed(1)}%`,
      `绘制CPU：均值${summary.drawMeanMs.toFixed(1)} / P95 ${summary.drawP95Ms.toFixed(1)} ms`,
      '',
      '## 场景与显示',
      '',
      `敌人${scene.enemies} · 攻击特效${scene.flashes}`,
      `图片${scene.imagesActive} / 池${scene.imagesPooled}`,
      `飘字${scene.numbersActive} / 池${scene.numbersPooled}（上限24）`,
      `画布：${scene.canvasWidth}×${scene.canvasHeight} · ${scene.density}倍采样`,
      `视口：${viewport.width}×${viewport.height} · DPR ${viewport.dpr}`,
      `浏览器UA：${browser}`,
      '',
      '## 读数限制',
      '',
      '- 仅当前浏览器最近采样窗口，不是整个关卡或整局的平均表现。',
      '- 绘制CPU只覆盖场景更新与绘图指令生成，不含GPU、呈现、React和完整模拟开销。',
      '- 暂停、天赋选择、阶段、倍速、关卡、尺寸变化与切后台后重新采样。',
      '- 低帧率可能受遮挡或浏览器节流影响；尺寸和UA不能据此认定真机，需在手机前台复测。',
      '- 用户主动捕获的本地文本，不含存档或完整访问地址，不会自动上传。',
      '',
    ].join('\n'),
  };
}
