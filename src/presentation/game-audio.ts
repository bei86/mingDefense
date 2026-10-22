import type { SoundCue } from './combat-feedback';
import { GameMusic, type MusicMood } from './game-music';

type Note = {
  frequency: number;
  end?: number;
  duration: number;
  delay?: number;
  wave?: OscillatorType;
};
const notes: Record<SoundCue, Note[]> = {
  click: [{ frequency: 520, duration: 0.035 }],
  deploy: [{ frequency: 660, end: 880, duration: 0.09 }],
  merge: [
    { frequency: 660, duration: 0.1 },
    { frequency: 990, duration: 0.16, delay: 0.08 },
  ],
  attack: [{ frequency: 180, end: 90, duration: 0.055, wave: 'triangle' }],
  income: [{ frequency: 1175, end: 1568, duration: 0.085 }],
  levelup: [
    { frequency: 523, duration: 0.1 },
    { frequency: 659, duration: 0.1, delay: 0.1 },
    { frequency: 784, duration: 0.2, delay: 0.2 },
  ],
  boss: [
    { frequency: 147, duration: 0.18, wave: 'triangle' },
    { frequency: 196, duration: 0.23, delay: 0.16, wave: 'triangle' },
  ],
  phase: [
    { frequency: 196, end: 294, duration: 0.15, wave: 'triangle' },
    { frequency: 392, duration: 0.2, delay: 0.13 },
  ],
  warning: [
    { frequency: 440, duration: 0.06 },
    { frequency: 440, duration: 0.06, delay: 0.13 },
  ],
  victory: [
    { frequency: 523, duration: 0.16 },
    { frequency: 659, duration: 0.16, delay: 0.13 },
    { frequency: 784, duration: 0.25, delay: 0.26 },
  ],
  defeat: [
    { frequency: 330, duration: 0.18 },
    { frequency: 262, duration: 0.2, delay: 0.16 },
    { frequency: 196, duration: 0.24, delay: 0.33 },
  ],
};
export const SOUND_PREFERENCE_KEY = 'ming-defense:audio';
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;
type Voice = { oscillator: OscillatorNode; gain: GainNode };
type AudioOptions = {
  context?: () => AudioContext;
  storage?: () => PreferenceStore;
  hidden?: () => boolean;
};

/** Short original synthesized cues. No queue, autoplay or external media. */
export class GameAudio {
  enabled = true;
  unavailable = false;
  readonly music: GameMusic;
  private context: AudioContext | null = null;
  private voices = new Set<Voice>();
  private last = new Map<SoundCue, number>();
  private lastAny = -Infinity;
  private lastCue: SoundCue | undefined;
  private resuming = false;
  private disposed = false;

  constructor(private options: AudioOptions = {}) {
    this.music = new GameMusic(() => this.store());
    try {
      this.enabled = this.store().getItem(SOUND_PREFERENCE_KEY) !== 'off';
    } catch {
      /* Optional preference only. */
    }
  }

  /** Must be called directly from a pointer or keyboard gesture. */
  unlock(): void {
    if (
      (!this.enabled && !this.music.enabled) ||
      this.unavailable ||
      this.disposed ||
      this.resuming
    )
      return;
    try {
      this.context ??= this.options.context ? this.options.context() : new AudioContext();
      if (this.context.state === 'closed') {
        this.unavailable = true;
        return;
      }
      if (this.context.state !== 'running') {
        this.resuming = true;
        void this.context
          .resume()
          .catch(() => {
            this.unavailable = true;
          })
          .finally(() => {
            this.resuming = false;
          });
      }
    } catch {
      this.unavailable = true;
    }
  }

  play(cue: SoundCue): void {
    const context = this.context;
    if (
      !this.enabled ||
      this.disposed ||
      this.unavailable ||
      !context ||
      context.state !== 'running' ||
      this.hidden()
    )
      return;
    const now = context.currentTime;
    const critical = ['boss', 'phase', 'warning', 'levelup', 'victory', 'defeat'].includes(cue);
    const gap = cue === 'attack' ? 0.14 : 0.08;
    const replacesClick = cue !== 'click' && this.lastCue === 'click';
    if (
      now - (this.last.get(cue) ?? -Infinity) < gap ||
      (!critical && !replacesClick && now - this.lastAny < 0.045)
    )
      return;
    if (critical || replacesClick) this.stop();
    if (this.voices.size + notes[cue].length > 12) return;
    this.last.set(cue, now);
    this.lastAny = now;
    this.lastCue = cue;
    try {
      for (const note of notes[cue]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        this.voices.add(voice);
        oscillator.onended = () => this.release(voice);
        const at = now + (note.delay ?? 0);
        oscillator.type = note.wave ?? 'sine';
        oscillator.frequency.setValueAtTime(note.frequency, at);
        oscillator.frequency.exponentialRampToValueAtTime(
          note.end ?? note.frequency,
          at + note.duration,
        );
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(cue === 'attack' ? 0.025 : 0.055, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + note.duration + 0.015);
      }
    } catch {
      this.unavailable = true;
      this.stop();
      this.music.dispose();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
    try {
      this.store().setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* Gameplay must remain available. */
    }
  }

  updateMusic(mood: MusicMood | null): void {
    if (this.disposed || this.unavailable) return;
    try {
      this.music.update(this.context, this.hidden() ? null : mood);
    } catch {
      this.unavailable = true;
      this.music.dispose();
      this.stop();
    }
  }

  setMusicEnabled(enabled: boolean): void {
    this.music.setEnabled(enabled, this.context);
  }

  suspend(): void {
    this.stop();
    this.music.stop(this.context);
  }

  playFeedback(cues: SoundCue[]): void {
    const priority: SoundCue[] = [
      'defeat',
      'victory',
      'phase',
      'boss',
      'warning',
      'levelup',
      'merge',
      'deploy',
      'income',
      'attack',
    ];
    const cue = priority.find((item) => cues.includes(item));
    if (cue) this.play(cue);
  }

  stop(): void {
    for (const voice of this.voices) {
      try {
        voice.oscillator.stop();
      } catch {
        /* A completed source may already be stopped. */
      }
      this.release(voice);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.music.dispose();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null;
  }

  private release(voice: Voice): void {
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }

  private store(): PreferenceStore {
    return this.options.storage ? this.options.storage() : localStorage;
  }
  private hidden(): boolean {
    return this.options.hidden ? this.options.hidden() : document.hidden;
  }
}
