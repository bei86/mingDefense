import { bossDefinition, enemyDefinitions } from '../game/content';
import type { Combat } from '../game/combat-model';

export type EnemySummonModel = {
  kind: 'boss' | 'summoner';
  enabled: boolean;
  phaseRecorded: boolean;
  triggerHpPercent: number | null;
  remainingMs: number | null;
  frozenMs: number;
  intervalMs: number;
  count: number;
  living: number;
  cap: number;
};

/** Snapshot this source's summon timer and capacity, without predicting a spawn. */
export function enemySummon(battle: Combat | null, enemyId: number): EnemySummonModel | null {
  const enemy = battle?.enemies.find((entry) => entry.id === enemyId && entry.hp > 0);
  if (!battle || !enemy || (enemy.kind !== 'boss' && enemy.kind !== 'summoner')) return null;
  const boss = bossDefinition(battle.stageId);
  const ordinary = enemyDefinitions.summoner.skills;
  const isBoss = enemy.kind === 'boss';
  const enabled = !isBoss || !!boss.summonFromStart || !!enemy.phase2;
  let count = ordinary.summonCount!;
  if (isBoss) {
    count = boss.summonCount;
    if (enemy.phase2) count = boss.phase2SummonCount ?? count;
  }
  return {
    kind: enemy.kind,
    enabled,
    phaseRecorded: !isBoss || enemy.phase2 !== undefined,
    triggerHpPercent: isBoss && !boss.summonFromStart ? boss.phase2HpPercent : null,
    remainingMs:
      enabled && enemy.nextSummon !== undefined
        ? Math.max(0, enemy.nextSummon - battle.time)
        : null,
    frozenMs: Math.max(0, (enemy.frozenUntil ?? 0) - battle.time),
    intervalMs: isBoss ? boss.summonIntervalMs : ordinary.summonEveryMs!,
    count,
    living: battle.enemies.filter(
      (entry) => entry.hp > 0 && entry.kind === 'summoned_wolf' && entry.owner === enemy.id,
    ).length,
    cap: isBoss ? boss.maxLivingSummons : ordinary.maxLivingSummons!,
  };
}
