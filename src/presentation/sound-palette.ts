import type { SoundCue } from './sound-cues';

export type SynthNote = {
  frequency: number;
  end?: number;
  duration: number;
  delay?: number;
  wave?: OscillatorType;
  gain?: number;
};

/** Original short tones; each battle cue's combined peak stays within the former attack's 0.025. */
export const soundPalette: Record<SoundCue, readonly SynthNote[]> = {
  click: [{ frequency: 520, duration: 0.035 }],
  deploy: [{ frequency: 660, end: 880, duration: 0.09 }],
  merge: [
    { frequency: 660, duration: 0.1 },
    { frequency: 990, duration: 0.16, delay: 0.08 },
  ],
  attack: [{ frequency: 180, end: 90, duration: 0.055, wave: 'triangle', gain: 0.025 }],
  mouse_attack: [
    { frequency: 620, end: 190, duration: 0.09, wave: 'sawtooth', gain: 0.012 },
    { frequency: 1050, end: 660, duration: 0.055, delay: 0.025, gain: 0.008 },
  ],
  boar_attack: [
    { frequency: 110, end: 48, duration: 0.12, wave: 'triangle', gain: 0.017 },
    { frequency: 68, end: 42, duration: 0.14, gain: 0.007 },
  ],
  eagle_attack: [
    { frequency: 1568, end: 2100, duration: 0.08, gain: 0.013 },
    { frequency: 2350, end: 1175, duration: 0.06, delay: 0.018, wave: 'triangle', gain: 0.009 },
  ],
  fish_attack: [
    { frequency: 1046, end: 523, duration: 0.13, gain: 0.013 },
    { frequency: 1568, end: 784, duration: 0.09, delay: 0.02, gain: 0.006 },
  ],
  fox_shield: [
    { frequency: 784, duration: 0.09, gain: 0.011 },
    { frequency: 1175, duration: 0.11, delay: 0.055, gain: 0.011 },
  ],
  monkey_attack: [
    { frequency: 360, end: 1440, duration: 0.08, wave: 'triangle', gain: 0.014 },
    { frequency: 880, end: 1760, duration: 0.055, delay: 0.02, gain: 0.008 },
  ],
  bear_attack: [
    { frequency: 82, end: 38, duration: 0.14, wave: 'triangle', gain: 0.018 },
    { frequency: 164, end: 65, duration: 0.09, delay: 0.018, wave: 'triangle', gain: 0.006 },
  ],
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
