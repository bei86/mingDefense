import manifest from './art-manifest.json';
import type { EnemyKind, HeroId } from '../game/content';
import type { BuffId } from '../game/model';

export type ArtKey = keyof typeof manifest;
export const artManifest = manifest;
export function artUrl(key: ArtKey): string {
  return `${import.meta.env.BASE_URL}assets/art/${manifest[key].file}`;
}
export const heroArt: Record<HeroId, ArtKey> = {
  ember_mouse: 'ember_mouse_idle',
  boar: 'boar_idle',
  sword_eagle: 'sword_eagle_idle',
  fortune_peach: 'fortune_peach_idle',
  ice_fish: 'ice_fish_idle',
  shield_fox: 'shield_fox_idle',
  piercing_monkey: 'piercing_monkey_idle',
  scatter_bear: 'scatter_bear_idle',
};
export const enemyArt: Partial<Record<EnemyKind, ArtKey>> = {
  wolf: 'wolf_idle',
  croc: 'croc_idle',
  split_fragment: 'split_fragment_idle',
  runner: 'runner_idle',
  ranged: 'ranged_idle',
  summoner: 'summoner_idle',
  splitter: 'splitter_idle',
  summoned_wolf: 'summoned_wolf_idle',
};
const bossArt: Partial<Record<number, ArtKey>> = {
  5: 'boss_05_idle',
  10: 'boss_10_idle',
  15: 'boss_15_idle',
  20: 'boss_20_idle',
  25: 'boss_25_idle',
  30: 'boss_30_idle',
  35: 'boss_35_idle',
  40: 'boss_40_idle',
};
const bossPhaseArt: Partial<Record<number, ArtKey>> = {
  25: 'boss_25_phase2',
  35: 'boss_35_phase2',
};
export function bossArtKey(stageId: number, phase2 = false): ArtKey | undefined {
  return (phase2 && bossPhaseArt[stageId]) || bossArt[stageId];
}
export const buffArt: Record<BuffId, ArtKey> = {
  attack: 'icon_attack',
  attack_speed: 'icon_speed',
  health: 'icon_hp',
  range: 'icon_pierce',
  slow: 'icon_ice',
  reward: 'icon_income',
  eagle_residue: 'icon_attack',
  boar_attack: 'icon_fist',
  bear_attack: 'icon_fist',
  monkey_vulnerability: 'icon_pierce',
  fox_shield: 'icon_shield',
  mouse_finisher: 'icon_execute',
  mouse_execute: 'icon_execute',
};
export const battlefieldArt: ArtKey[] = [
  ...Object.values(heroArt),
  ...Object.values(enemyArt).filter((key): key is ArtKey => key !== undefined),
  ...Object.values(bossArt).filter((key): key is ArtKey => key !== undefined),
  ...Object.values(bossPhaseArt).filter((key): key is ArtKey => key !== undefined),
  'battlefield_forest',
  'fx_sword_field',
  'fx_shield',
  'fx_slow',
  'fx_freeze',
  'fx_heavy_hit',
  'fx_fireball',
  'fx_pierce',
  'fx_fist',
  'fx_income',
  'fx_summon',
  'fx_merge',
  'fx_levelup',
];
