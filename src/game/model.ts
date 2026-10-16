import type { HeroId, Point } from './content';

export type Unit = { id: number; kind: HeroId; rank: number; position: Point | null };
export type BuffId =
  | 'attack'
  | 'attack_speed'
  | 'health'
  | 'range'
  | 'slow'
  | 'reward'
  | 'eagle_residue'
  | 'boar_attack'
  | 'bear_attack'
  | 'fox_shield'
  | 'mouse_finisher'
  | 'mouse_execute';
export type Progression = {
  level: number;
  xp: number;
  buffs: Partial<Record<BuffId, number>>;
  rng: number;
};
