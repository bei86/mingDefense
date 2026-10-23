import { combatSoundCues, isCombatSound, type CombatSoundCue, type SoundCue } from './sound-cues';
import { soundPalette } from './sound-palette';
import { GameMusic, type MusicMood } from './game-music';
import { AudioVolume, SOUND_VOLUME_KEY } from './audio-volume';

export const SOUND_PREFERENCE_KEY = 'ming-defense:audio';
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;
type Voice = { oscillator: OscillatorNode; gain: GainNode | null };
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
  private level: AudioVolume;
  private context: AudioContext | null = null;
  private voices = new Set<Voice>();
  private last = new Map<SoundCue, number>();
  private lastAny = -Infinity;
  private lastCombatAt = -Infinity;
  private lastCombatCue: CombatSoundCue | undefined;
  private criticalUntil = -Infinity;
  private lastCue: SoundCue | undefined;
  private resuming = false;
  private disposed = false;

  constructor(private options: AudioOptions = {}) {
    this.music = new GameMusic(() => this.store());
    this.level = new AudioVolume(SOUND_VOLUME_KEY, () => this.store());
    try {
      this.enabled = this.store().getItem(SOUND_PREFERENCE_KEY) !== 'off';
    } catch {
      /* Optional preference only. */
    }
  }

  get volume(): number {
    return this.level.value;
  }

  setVolume(value: number): void {
    if (this.disposed) return;
    try {
      this.level.set(value);
    } catch {
      this.fail();
    }
  }

  setMusicVolume(value: number): void {
    if (this.disposed) return;
    try {
      this.music.setVolume(value);
    } catch {
      this.fail();
    }
  }

  /** Must be called directly from a pointer or keyboard gesture. */
  unlock(): void {
    if (
      ((!this.enabled || this.volume === 0) && (!this.music.enabled || this.music.volume === 0)) ||
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
      this.volume === 0 ||
      this.disposed ||
      this.unavailable ||
      !context ||
      context.state !== 'running' ||
      this.hidden()
    )
      return;
    const now = context.currentTime;
    const critical = ['boss', 'phase', 'warning', 'levelup', 'victory', 'defeat'].includes(cue);
    const combat = isCombatSound(cue);
    const gap = combat ? 0.14 : 0.08;
    const replacesClick = cue !== 'click' && this.lastCue === 'click';
    if (
      now - (this.last.get(cue) ?? -Infinity) < gap ||
      (combat && now - this.lastCombatAt < 0.14) ||
      (!critical && now < this.criticalUntil) ||
      (!critical && !replacesClick && now - this.lastAny < 0.045)
    )
      return;
    if (critical || replacesClick) this.stop();
    if (this.voices.size + soundPalette[cue].length > 12) return;
    this.last.set(cue, now);
    this.lastAny = now;
    this.lastCue = cue;
    if (combat) {
      this.lastCombatAt = now;
      this.lastCombatCue = cue;
    }
    if (critical)
      this.criticalUntil =
        now +
        Math.max(...soundPalette[cue].map((note) => (note.delay ?? 0) + note.duration)) +
        0.02;
    try {
      const output = this.level.output(context);
      for (const note of soundPalette[cue]) {
        const oscillator = context.createOscillator();
        // Track each node as soon as it exists, even if the next allocation fails.
        const voice: Voice = { oscillator, gain: null };
        this.voices.add(voice);
        const gain = context.createGain();
        voice.gain = gain;
        oscillator.onended = () => this.release(voice);
        const at = now + (note.delay ?? 0);
        oscillator.type = note.wave ?? 'sine';
        oscillator.frequency.setValueAtTime(note.frequency, at);
        oscillator.frequency.exponentialRampToValueAtTime(
          note.end ?? note.frequency,
          at + note.duration,
        );
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.gain ?? 0.055, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.start(at);
        oscillator.stop(at + note.duration + 0.015);
      }
    } catch {
      this.fail();
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
      this.fail();
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
    ];
    const cue = priority.find((item) => cues.includes(item));
    if (cue) {
      this.play(cue);
      return;
    }
    const start = this.lastCombatCue ? combatSoundCues.indexOf(this.lastCombatCue) + 1 : 0;
    for (let offset = 0; offset < combatSoundCues.length; offset++) {
      const combat = combatSoundCues[(start + offset) % combatSoundCues.length];
      if (cues.includes(combat)) {
        this.play(combat);
        return;
      }
    }
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
    this.level.dispose();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null;
  }

  private fail(): void {
    this.unavailable = true;
    this.stop();
    this.music.dispose();
    this.level.dispose();
  }

  private release(voice: Voice): void {
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain?.disconnect();
    this.voices.delete(voice);
  }

  private store(): PreferenceStore {
    return this.options.storage ? this.options.storage() : localStorage;
  }
  private hidden(): boolean {
    return this.options.hidden ? this.options.hidden() : document.hidden;
  }
}
