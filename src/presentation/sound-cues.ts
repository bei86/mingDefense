import type { Flash } from '../game/combat-model';
import type { HeroId } from '../game/content';

export const combatSoundCues = [
  'mouse_attack',
  'boar_attack',
  'eagle_attack',
  'fish_attack',
  'fox_shield',
  'monkey_attack',
  'bear_attack',
  'attack',
] as const;
export type CombatSoundCue = (typeof combatSoundCues)[number];
export type SoundCue =
  | CombatSoundCue
  | 'click'
  | 'deploy'
  | 'merge'
  | 'income'
  | 'levelup'
  | 'boss'
  | 'phase'
  | 'warning'
  | 'victory'
  | 'defeat';

const heroSounds: Partial<Record<HeroId, CombatSoundCue>> = {
  ember_mouse: 'mouse_attack',
  boar: 'boar_attack',
  sword_eagle: 'eagle_attack',
  ice_fish: 'fish_attack',
  shield_fox: 'fox_shield',
  piercing_monkey: 'monkey_attack',
  scatter_bear: 'bear_attack',
};

export function combatSound(flash: Flash): CombatSoundCue {
  if (flash.team !== 'ally' || !flash.kind) return 'attack';
  return heroSounds[flash.kind] ?? 'attack';
}

export function isCombatSound(cue: SoundCue): cue is CombatSoundCue {
  return (combatSoundCues as readonly string[]).includes(cue);
}
