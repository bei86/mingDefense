import {
  bossDefinition,
  bossDescription,
  bossName,
  config,
  enemyAppearances,
  enemyDefinitions,
  stageNames,
  stages,
  type EnemyKind,
} from '../game/content';
import type { Spawn } from '../game/combat-model';
import { waveSpawns } from '../game/combat';

export type EnemyIntelEntry = {
  kind: EnemyKind;
  name: string;
  count: number;
  firstAt?: number;
  lastAt?: number;
  hp: number;
  damage: number;
  intervalMs: number;
  speed: number;
  range: number;
  xp: number;
  energy: number;
  skills: string[];
};

export type StageIntelSummary = {
  stageId: number;
  name: string;
  reward: number;
  total: number;
  lastSpawnAt: number;
  enemies: EnemyIntelEntry[];
  derived: EnemyIntelEntry[];
  waves: EnemyWaveIntel[];
};

export type EnemyWaveIntel = {
  index: number;
  startAt: number;
  firstAt?: number;
  lastAt?: number;
  total: number;
  counts: { kind: EnemyKind; name: string; count: number }[];
};

function waveIntel(stageId: number, spawns: readonly Spawn[]): EnemyWaveIntel[] {
  const starts = stages[stageId - 1].waves.map((wave) => wave.atMs);
  const groups: Spawn[][] = starts.map(() => []);
  let index = 0;
  for (const spawn of spawns) {
    while (index + 1 < starts.length && spawn.at >= starts[index + 1]) index++;
    groups[index].push(spawn);
  }
  return groups.map((group, index) => {
    const counts = new Map<EnemyKind, number>();
    for (const spawn of group) {
      const kind = spawn.kind ?? 'wolf';
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return {
      index: index + 1,
      startAt: starts[index],
      firstAt: group[0]?.at,
      lastAt: group.at(-1)?.at,
      total: group.length,
      counts: [...counts].map(([kind, count]) => ({
        kind,
        name: kind === 'boss' ? bossName(stageId) : enemyAppearances[kind].name,
        count,
      })),
    };
  });
}

function enemySkills(kind: EnemyKind, stageId: number): string[] {
  switch (kind) {
    case 'boss': {
      const boss = bossDefinition(stageId);
      return [
        bossDescription(stageId),
        `横扫每${boss.cleaveIntervalMs / 1000}秒预警一次，首段对锁定前排每位灵兽造成${boss.cleaveHitDamage}基础伤害；冻结可推迟技能。`,
      ];
    }
    case 'wolf': {
      const skill = enemyDefinitions.wolf.skills;
      if (stageId < skill.rageEnabledFromStage!) return ['近战，本关尚未启用狂暴。'];
      return [
        `存活每${skill.rageEveryMs! / 1000}秒增加${skill.rageAttackPercent}%普攻伤害，最多${skill.rageMaxStacks}层。`,
      ];
    }
    case 'croc':
      return [`受到的伤害降低${enemyDefinitions.croc.skills.damageReductionPercent}%。`];
    case 'summoner': {
      const skill = enemyDefinitions.summoner.skills;
      return [
        `出生${skill.firstSummonDelayMs! / 1000}秒后首次召唤，之后每${skill.summonEveryMs! / 1000}秒召${skill.summonCount}只咒影；每位召唤者最多同时保有${skill.maxLivingSummons}只。冻结会推迟召唤。`,
      ];
    }
    case 'splitter':
      return [`死亡时生成${enemyDefinitions.splitter.skills.onDeathSpawnCount}只碎岩灵。`];
    default:
      return [enemyAppearances[kind].description + '。'];
  }
}

function enemyEntry(kind: EnemyKind, stageId: number, times: number[] = []): EnemyIntelEntry {
  const stage = stages[stageId - 1];
  const boss = kind === 'boss';
  const definition = boss ? bossDefinition(stageId) : enemyDefinitions[kind];
  return {
    kind,
    name: boss ? bossName(stageId) : enemyAppearances[kind].name,
    count: times.length,
    firstAt: times[0],
    lastAt: times.at(-1),
    hp: Math.round(definition.hp * (boss ? 1 : stage.hpMultiplier)),
    damage: Math.round(definition.hitDamage * (boss ? 1 : stage.attackMultiplier)),
    intervalMs: definition.actionIntervalMs,
    speed: definition.speedCellsPerSecond,
    range: definition.rangeCells,
    xp: definition.xp,
    energy: boss
      ? config.energy.bossKillGain
      : (enemyDefinitions[kind].energyGain ?? config.energy.perKill),
    skills: enemySkills(kind, stageId),
  };
}

export function stageIntel(stageId: number, schedule?: readonly Spawn[]): StageIntelSummary {
  if (!Number.isInteger(stageId) || stageId < 1 || stageId > stages.length)
    throw new RangeError('敌情关卡超出范围');
  const spawns = schedule ?? waveSpawns(stageId);
  const timesByKind = new Map<EnemyKind, number[]>();
  for (const spawn of spawns) {
    const kind = spawn.kind ?? 'wolf';
    const times = timesByKind.get(kind) ?? [];
    times.push(spawn.at);
    timesByKind.set(kind, times);
  }
  const derivedKinds = new Set<EnemyKind>();
  if (timesByKind.has('boss') || timesByKind.has('summoner')) derivedKinds.add('summoned_wolf');
  if (timesByKind.has('splitter')) derivedKinds.add('split_fragment');
  return {
    stageId,
    name: stageNames[stageId - 1],
    reward: stages[stageId - 1].reward,
    total: spawns.length,
    lastSpawnAt: spawns.at(-1)?.at ?? 0,
    enemies: [...timesByKind].map(([kind, times]) => enemyEntry(kind, stageId, times)),
    derived: [...derivedKinds].map((kind) => enemyEntry(kind, stageId)),
    waves: waveIntel(stageId, spawns),
  };
}
