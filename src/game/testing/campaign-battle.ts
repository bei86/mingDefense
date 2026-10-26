import type { Session } from '../session';
import {
  appearances,
  cells,
  clone,
  key,
  type HeroId,
  type Point,
  type EnemyKind,
} from '../content';
import type { BuffId, Progression } from '../model';

import type { Combat } from '../combat-model';
import { observeEnemies, type EnemyLifetime } from '../combat-diagnostics';
import {
  observeEnemyDamage,
  enemyDamageSnapshot,
  type EnemyDamageReport,
} from '../enemy-damage-diagnostics';

export type SimulationOptions = {
  protectPeach?: boolean;
  survivalBuffs?: boolean;
  audit?: boolean;
  allDeaths?: boolean;
  enemyDamage?: boolean;
};
export type CampaignBattleAudit = {
  deployed: number;
  reserves: number;
  emptyCells: number;
  openingMaxHp: number;
  openingMoney: number;
  roster: { id: number; kind: HeroId; rank: number; position: Point | null }[];
  peachMoves: number;
  firstDeath?: { id: number; kind: HeroId; rank: number; position: Point; time: number };
  deaths?: { id: number; kind: HeroId; rank: number; position: Point; time: number }[];
  aliveEnemies: { kind: EnemyKind; hp: number }[];
  unspawned: number;
};
const survivalPriority: BuffId[] = [
  'health',
  'attack_speed',
  'attack',
  'slow',
  'boar_attack',
  'bear_attack',
  'monkey_vulnerability',
  'eagle_residue',
  'range',
  'reward',
];

export type BattleSample = {
  stage: number;
  result: string;
  time: number;
  hp: number;
  money: number;
  bossHp?: number;
  lineup: string;
  damageDone: number;
  damageTaken: number;
  kills: number;
  injured: number;
  hpRatio: number;
  report: Combat['report'];
  buffs: Progression['buffs'];
  enemies?: EnemyLifetime[];
  audit?: CampaignBattleAudit;
  enemyDamage?: EnemyDamageReport;
};

/** Execute exactly the current prepared battle; no recruiting or stage advancement. */
export function runPreparedBattle(
  s: Session,
  policy: string,
  boost = true,
  diagnostics = false,
  options: SimulationOptions = {},
  peachMoves = 0,
): BattleSample {
  const stage = s.preparation.stageId;
  const lineup = s.preparation.units
    .map((u) => `${appearances[u.kind].name}${u.rank}${u.position ? '' : '(备)'}`)
    .join('/');
  const error = s.start();
  if (error) throw new Error(error);
  if (options.enemyDamage) observeEnemyDamage(s.battle!);
  const enemies = diagnostics ? observeEnemies(s.battle!) : undefined;
  const occupied = options.audit
    ? new Set(
        s.preparation.units.flatMap((u) => (u.position ? cells(u.kind, u.position).map(key) : [])),
      )
    : null;
  const audit: CampaignBattleAudit | undefined = options.audit
    ? {
        deployed: s.battle!.allies.length,
        reserves: s.preparation.units.filter((u) => !u.position).length,
        emptyCells: s.preparation.unlocked.filter((k) => !occupied!.has(k)).length,
        openingMaxHp: s.battle!.allies.reduce((n, u) => n + u.maxHp, 0),
        openingMoney: s.preparation.currency,
        roster: clone(s.preparation.units),
        peachMoves,
        ...(options.allDeaths ? { deaths: [] } : {}),
        aliveEnemies: [],
        unspawned: 0,
      }
    : undefined;
  let priority: BuffId[] =
    policy === 'economy'
      ? [
          'reward',
          'attack',
          'attack_speed',
          'bear_attack',
          'monkey_vulnerability',
          'health',
          'slow',
          'range',
        ]
      : [
          'attack',
          'attack_speed',
          'boar_attack',
          'bear_attack',
          'monkey_vulnerability',
          'eagle_residue',
          'health',
          'slow',
          'range',
          'reward',
        ];
  if (options.survivalBuffs) priority = survivalPriority;
  for (let tick = 0; tick < 10000; tick++) {
    if (s.hasChoices)
      s.chooseBuff(
        [...s.battle!.choices].sort(
          (a, b) =>
            (priority.indexOf(a) < 0 ? 99 : priority.indexOf(a)) -
            (priority.indexOf(b) < 0 ? 99 : priority.indexOf(b)),
        )[0],
      );
    else if (s.phase === 'combat') {
      s.held = boost && s.battle!.energy >= 1;
      s.tick();
      if (audit?.deaths) {
        for (const dead of s.battle!.allies.filter((u) => u.hp <= 0).sort((a, b) => a.id - b.id)) {
          if (!audit.deaths.some((u) => u.id === dead.id))
            audit.deaths.push({
              id: dead.id,
              kind: dead.kind,
              rank: dead.rank,
              position: { ...dead.position },
              time: s.battle!.time,
            });
        }
      }
      if (audit && !audit.firstDeath) {
        const dead = s.battle!.allies.filter((u) => u.hp <= 0).sort((a, b) => a.id - b.id)[0];
        if (dead)
          audit.firstDeath = {
            id: dead.id,
            kind: dead.kind,
            rank: dead.rank,
            position: { ...dead.position },
            time: s.battle!.time,
          };
      }
    } else break;
  }
  if (audit) {
    audit.aliveEnemies = s
      .battle!.enemies.filter((e) => e.hp > 0)
      .map((e) => ({ kind: e.kind ?? 'wolf', hp: e.hp }));
    audit.unspawned = s.battle!.spawns.length - s.battle!.spawnIndex;
  }
  return {
    stage,
    result: s.phase,
    time: s.battle!.time,
    hp: s.totalHealth(),
    money: s.preparation.currency,
    bossHp: s.battle!.enemies.find((e) => e.kind === 'boss')?.hp,
    lineup,
    damageDone: s.battle!.damageDone,
    damageTaken: s.battle!.damageTaken,
    kills: s.battle!.kills,
    injured: s.battle!.allies.filter((u) => u.hp <= 0).length,
    hpRatio: s.totalHealth() / s.battle!.allies.reduce((n, u) => n + u.maxHp, 0),
    report: clone(s.battle!.report),
    buffs: s.battle!.progression.buffs,
    ...(enemies ? { enemies: clone(enemies) } : {}),
    ...(audit ? { audit } : {}),
    ...(options.enemyDamage ? { enemyDamage: enemyDamageSnapshot(s.battle!)! } : {}),
  };
}
