export const SOUND_VOLUME_KEY = 'ming-defense:audio-volume';
export const MUSIC_VOLUME_KEY = 'ming-defense:music-volume';
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;

/** A relative level: 100 preserves the original mix, and never amplifies it. */
export class AudioVolume {
  private percent = 100;
  private gain: GainNode | null = null;
  private context: AudioContext | null = null;

  constructor(
    private key: string,
    private storage: () => PreferenceStore = () => localStorage,
  ) {
    try {
      const saved = storage().getItem(key);
      if (saved !== null && /^(?:0|[1-9]\d?|100)$/.test(saved)) this.percent = Number(saved);
    } catch {
      /* Preferences must not block play. */
    }
  }

  get value(): number {
    return this.percent;
  }

  set(value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.round(Math.max(0, Math.min(100, value)));
    if (next === this.percent) return;
    this.percent = next;
    try {
      this.storage().setItem(this.key, String(next));
    } catch {
      /* Keep the in-memory level when storage is restricted. */
    }
    if (this.gain && this.context && this.context.state !== 'closed') {
      const now = this.context.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(next / 100, now, 0.015);
    }
  }

  output(context: AudioContext): GainNode {
    if (this.context !== context) this.dispose();
    if (!this.gain) {
      this.context = context;
      this.gain = context.createGain();
      this.gain.gain.setValueAtTime(this.percent / 100, context.currentTime);
      this.gain.connect(context.destination);
    }
    return this.gain;
  }

  dispose(): void {
    this.gain?.disconnect();
    this.gain = null;
    this.context = null;
  }
}
