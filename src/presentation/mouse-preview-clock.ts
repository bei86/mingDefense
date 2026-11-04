import type { MouseMotion } from './mouse-motion';

export type MouseAction = MouseMotion['action'];
export const mousePreviewClips = {
  idle: { count: 4, frameMs: 200 },
  attack: { count: 6, frameMs: 70 },
  hurt: { count: 3, frameMs: 60 },
  fallen: { count: 5, frameMs: 80 },
} as const;

/** Asset inspection only. Never drives a Session, attack event or stored preference. */
export class MousePreviewClock {
  speed: 1 | 2 = 1;
  private action: MouseAction = 'idle';
  private elapsed = 0;
  private playing = true;
  private reduced = false;

  snapshot() {
    const clip = mousePreviewClips[this.action];
    return {
      action: this.action,
      frame: Math.min(clip.count - 1, Math.floor(this.elapsed / clip.frameMs)),
      count: clip.count,
      playing: this.playing,
      reduced: this.reduced,
      speed: this.speed,
    };
  }

  advance(deltaMs: number, visible = true): void {
    if (!visible || !this.playing || this.reduced || !Number.isFinite(deltaMs)) return;
    const clip = mousePreviewClips[this.action];
    this.elapsed += Math.max(0, Math.min(100, deltaMs)) * this.speed;
    const end = clip.count * clip.frameMs;
    if (this.action === 'idle') this.elapsed %= end;
    else if (this.elapsed >= end) {
      this.elapsed = (clip.count - 1) * clip.frameMs;
      this.playing = false;
    }
  }

  select(action: MouseAction): void {
    this.action = action;
    this.replay();
  }

  toggle(): void {
    if (this.reduced) return;
    if (!this.playing && this.snapshot().frame === this.snapshot().count - 1) this.replay();
    else this.playing = !this.playing;
  }

  replay(): void {
    const clip = mousePreviewClips[this.action];
    this.elapsed = this.reduced && this.action === 'fallen' ? (clip.count - 1) * clip.frameMs : 0;
    this.playing = !this.reduced;
  }

  seek(frame: number): void {
    if (this.reduced || !Number.isFinite(frame)) return;
    const clip = mousePreviewClips[this.action];
    this.elapsed = Math.max(0, Math.min(clip.count - 1, Math.floor(frame))) * clip.frameMs;
    this.playing = false;
  }

  step(direction: -1 | 1): void {
    this.seek(this.snapshot().frame + direction);
  }

  setReduced(value: boolean): void {
    if (this.reduced === value) return;
    this.reduced = value;
    if (value) {
      this.replay();
      this.playing = false;
    }
  }
}
