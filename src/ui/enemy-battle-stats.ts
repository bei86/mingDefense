import {
  bossDefinition,
  config,
  enemyDefinitions,
  heroes,
  stages,
  type EnemyKind,
} from '../game/content';
import type { Combat } from '../game/combat-model';
import { bonus } from '../game/progression';

export type EnemyBattleStatsModel = {
  kind: EnemyKind;
  baseDamage: number;
  damage: number;
  intervalMs: number;
  range: number;
  speed: number;
  slowPercent: number;
  frozen: boolean;
  phase2SpeedPercent: number;
  phaseRecorded: boolean;
  rage: { stacks: number; maxStacks: number; percent: number; birthRecorded: boolean } | null;
};

/** Snapshot current parameters only; never advance phases, timers or targeting. */
export function enemyBattleStats(
  battle: Combat | null,
  enemyId: number,
): EnemyBattleStatsModel | null {
  const enemy = battle?.enemies.find((entry) => entry.id === enemyId && entry.hp > 0);
  if (!battle || !enemy) return null;
  const kind = enemy.kind ?? 'wolf';
  const boss = bossDefinition(battle.stageId);
  const definition = kind === 'boss' ? boss : enemyDefinitions[kind];
  const baseDamage =
    kind === 'boss'
      ? definition.hitDamage
      : Math.round(definition.hitDamage * stages[battle.stageId - 1].attackMultiplier);
  let damage = baseDamage;
  let rage: EnemyBattleStatsModel['rage'] = null;
  // Match releaseAttack: a legacy missing kind uses wolf base stats but has no rage.
  const skill = enemyDefinitions.wolf.skills;
  if (enemy.kind === 'wolf' && battle.stageId >= skill.rageEnabledFromStage!) {
    const stacks = Math.min(
      skill.rageMaxStacks!,
      Math.floor((battle.time - (enemy.born ?? 0)) / skill.rageEveryMs!),
    );
    const percent = stacks * skill.rageAttackPercent!;
    rage = {
      stacks,
      maxStacks: skill.rageMaxStacks!,
      percent,
      birthRecorded: enemy.born !== undefined,
    };
    damage = Math.floor(baseDamage * (1 + percent / 100));
  }
  const phase2SpeedPercent = enemy.phase2 ? boss.phase2AttackSpeedBonusPercent : 0;
  const intervalMs =
    Math.ceil(
      definition.actionIntervalMs / (1 + phase2SpeedPercent / 100) / config.runtime.tickMs,
    ) * config.runtime.tickMs;
  const localSlow = (enemy.slowUntil ?? 0) > battle.time ? heroes.ice_fish.skills.slowPercent! : 0;
  const slowPercent = Math.min(
    config.damage.slowCapPercent,
    localSlow + bonus(battle.progression, 'slow'),
  );
  return {
    kind,
    baseDamage,
    damage,
    intervalMs,
    range: definition.rangeCells,
    speed: definition.speedCellsPerSecond * (1 - slowPercent / 100),
    slowPercent,
    frozen: (enemy.frozenUntil ?? 0) > battle.time,
    phase2SpeedPercent,
    phaseRecorded: enemy.phase2 !== undefined,
    rage,
  };
}
