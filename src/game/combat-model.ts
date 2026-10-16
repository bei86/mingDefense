import type { EnemyKind, HeroId, Point } from './content';
import type { BuffId, Progression, Unit } from './model';

export type Ally = Unit & {
  position: Point;
  hp: number;
  maxHp: number;
  cooldown: number;
  ordinal: number;
  shield?: number;
  shieldExpires?: number;
  incomeAt?: number;
};
export type Enemy = Point & {
  id: number;
  kind?: EnemyKind;
  hp: number;
  maxHp?: number;
  cooldown: number;
  target: number | null;
  recheckAt: number;
  slowUntil?: number;
  frozenUntil?: number;
  phase2?: boolean;
  nextCleave?: number;
  nextSummon?: number;
  owner?: number;
  vulnerabilityUntil?: number;
  vulnerabilityPercent?: number;
};
export type Attack = {
  due: number;
  source: number;
  target: number;
  team: 'ally' | 'enemy';
  ordinal: number;
};
type ReleasedBase = {
  due: number;
  damage: number;
  kind: HeroId;
  source: number;
};
export type LineHit = ReleasedBase & {
  shape: 'line';
  point: Point;
  direction: Point;
  range: number;
  halfWidth: number;
  vulnerability?: { percent: number; durationMs: number };
};
export type ReleasedHit =
  | LineHit
  | (ReleasedBase & {
      shape: 'area';
      target: number;
      point: Point;
      radius: number;
    });
export type Field = Point & {
  id: number;
  born: number;
  damage: number;
  hits: number;
  source?: number;
};
export type Flash = { from: Point; to: Point; at: number; team: 'ally' | 'enemy'; kind?: HeroId };
export type Warning = { source: number; row: number; due: number };
export type Spawn = { at: number; x: number; kind?: EnemyKind };
export type UnitBattleStats = {
  id: number;
  damageDone: number;
  damageTaken: number;
  income: number;
  shieldGiven: number;
  shieldAbsorbed: number;
};
export type BattleReport = { units: UnitBattleStats[]; boostedMs: number };
export type Combat = {
  time: number;
  stageId: number;
  allies: Ally[];
  enemies: Enemy[];
  attacks: Attack[];
  released: ReleasedHit[];
  fields: Field[];
  warnings: Warning[];
  spawns: Spawn[];
  spawnIndex: number;
  energy: number;
  boosted: boolean;
  kills: number;
  flashes: Flash[];
  nextFieldId: number;
  nextEnemyId: number;
  result: 'victory' | 'defeat' | null;
  progression: Progression;
  progressionEnabled: boolean;
  pendingChoices: number;
  choices: BuffId[];
  income: number;
  fallbackIncome: number;
  xpEarned: number;
  rng: number;
  damageDone: number;
  damageTaken: number;
  report?: BattleReport;
};
export type Packet = {
  team: 'ally' | 'enemy';
  id: number;
  damage: number;
  slow?: boolean;
  freeze?: boolean;
  source?: number;
  vulnerability?: { percent: number; durationMs: number };
};
