export type FrameSummary = {
  frames: number;
  fps: number;
  p95Ms: number;
  slowPercent: number;
  drawMeanMs: number;
  drawP95Ms: number;
};

/** Bounded, view-only intervals. Page suspension starts a fresh measurement window. */
export class FrameMetrics {
  private samples: { interval: number; drawMs: number }[] = [];
  private cursor = 0;
  private previous: number | null = null;

  reset(): void {
    this.samples = [];
    this.cursor = 0;
    this.previous = null;
  }

  record(now: number, drawMs = 0): void {
    if (!Number.isFinite(now)) {
      this.reset();
      return;
    }
    const elapsed = this.previous === null ? null : now - this.previous;
    this.previous = now;
    if (elapsed === null || elapsed === 0) return;
    if (elapsed < 0) {
      this.samples = [];
      this.cursor = 0;
      return;
    }
    this.samples[this.cursor] = { interval: elapsed, drawMs: Math.max(0, drawMs) };
    this.cursor = (this.cursor + 1) % 120;
  }

  snapshot(): FrameSummary | null {
    if (!this.samples.length) return null;
    const sorted = this.samples.map((sample) => sample.interval).sort((a, b) => a - b);
    const drawing = this.samples.map((sample) => sample.drawMs).sort((a, b) => a - b);
    const frames = sorted.length;
    return {
      frames,
      fps: (1000 * frames) / sorted.reduce((sum, ms) => sum + ms, 0),
      p95Ms: sorted[Math.ceil(frames * 0.95) - 1],
      slowPercent: (100 * sorted.filter((ms) => ms > 50).length) / frames,
      drawMeanMs: drawing.reduce((sum, ms) => sum + ms, 0) / frames,
      drawP95Ms: drawing[Math.ceil(frames * 0.95) - 1],
    };
  }
}
