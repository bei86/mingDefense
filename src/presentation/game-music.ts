import type { Session } from '../game/session';

export type MusicMood = 'prepare' | 'combat';
export const MUSIC_PREFERENCE_KEY = 'ming-defense:music';
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;
type Voice = { oscillator: OscillatorNode; gain: GainNode; stopping: boolean };

// Original pentatonic phrases. Null beats leave room for battle cues.
const phrases: Record<MusicMood, (number | null)[]> = {
  prepare: [
    0,
    null,
    2,
    4,
    7,
    null,
    4,
    2,
    9,
    null,
    7,
    4,
    2,
    null,
    0,
    null,
    2,
    null,
    4,
    7,
    12,
    null,
    9,
    7,
    4,
    null,
    2,
    4,
    0,
    null,
    null,
    null,
  ],
  combat: [
    0,
    7,
    null,
    12,
    9,
    7,
    4,
    null,
    2,
    7,
    null,
    9,
    7,
    4,
    2,
    null,
    4,
    9,
    null,
    12,
    14,
    12,
    9,
    null,
    7,
    4,
    2,
    7,
    0,
    null,
    0,
    null,
  ],
};

export function musicMood(session: Session): MusicMood | null {
  if (session.hasChoices) return null;
  if (session.phase === 'prepare') return 'prepare';
  if (session.phase === 'combat' && session.canAdvance) return 'combat';
  return null;
}

/** Shares GameAudio's context and display loop; never advances the simulation. */
export class GameMusic {
  enabled = false;
  private mood: MusicMood | null = null;
  private nextBeat = 0;
  private beat = 0;
  private voices = new Set<Voice>();
  private disposed = false;

  constructor(private storage: () => PreferenceStore = () => localStorage) {
    try {
      this.enabled = storage().getItem(MUSIC_PREFERENCE_KEY) === 'on';
    } catch {
      /* Preferences are optional. */
    }
  }

  setEnabled(enabled: boolean, context: AudioContext | null): void {
    this.enabled = enabled;
    if (!enabled) this.stop(context);
    try {
      this.storage().setItem(MUSIC_PREFERENCE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* A storage restriction must not interrupt play. */
    }
  }

  update(context: AudioContext | null, mood: MusicMood | null): void {
    if (this.disposed) return;
    if (!this.enabled || !context || context.state !== 'running' || !mood) {
      this.stop(context);
      return;
    }
    const now = context.currentTime;
    if (this.mood !== mood) {
      this.stop(context);
      this.mood = mood;
      this.nextBeat = now;
    }
    if (now < this.nextBeat) return;
    const interval = mood === 'prepare' ? 0.6 : 0.4;
    // A late browser tick plays one new beat, never an accumulated backlog.
    this.nextBeat = now + interval;
    const at = now + 0.01;
    const semitone = phrases[mood][this.beat % 32];
    if (semitone !== null) {
      this.note(context, 261.63 * 2 ** (semitone / 12), at, interval * 0.85, 0.018, 'sine');
    }
    if (this.beat % 4 === 0) {
      const bass = this.beat % 16 < 8 ? 130.81 : 146.83;
      this.note(context, bass, at, interval * 2.5, 0.009, 'triangle');
    }
    this.beat = (this.beat + 1) % 32;
  }

  stop(context: AudioContext | null): void {
    this.mood = null;
    this.beat = 0;
    this.nextBeat = 0;
    for (const voice of this.voices) {
      if (!context || context.state !== 'running') {
        this.release(voice);
      } else if (!voice.stopping) {
        voice.stopping = true;
        const now = context.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, 0.008);
        voice.oscillator.stop(now + 0.04);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const voice of this.voices) this.release(voice);
  }

  private note(
    context: AudioContext,
    frequency: number,
    at: number,
    duration: number,
    volume: number,
    wave: OscillatorType,
  ): void {
    if (this.voices.size >= 6) return;
    const oscillator = context.createOscillator();
    let gain: GainNode;
    try {
      gain = context.createGain();
    } catch (error) {
      oscillator.disconnect();
      throw error;
    }
    const voice = { oscillator, gain, stopping: false };
    this.voices.add(voice);
    oscillator.onended = () => this.release(voice);
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private release(voice: Voice): void {
    voice.oscillator.onended = null;
    try {
      voice.oscillator.stop();
    } catch {
      /* A source may have already ended or not yet started. */
    }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
}
