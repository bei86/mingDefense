import { config } from './content';
import type { BuffId, Progression, Unit } from './model';
import { random } from './random';

export const buffDefinitions = Object.fromEntries(config.buffs.map((b) => [b.id, b])) as Record<
  BuffId,
  (typeof config.buffs)[number]
>;
export const buffLabels: Record<BuffId, { name: string; description: string }> = {
  attack: { name: '锐意', description: `全体灵兽攻击 +${buffDefinitions.attack.valuePerLevel}%` },
  attack_speed: {
    name: '疾风',
    description: `全体灵兽攻速 +${buffDefinitions.attack_speed.valuePerLevel}%`,
  },
  health: {
    name: '生息',
    description: `最大生命 +${buffDefinitions.health.valuePerLevel}%，存活灵兽补足增量`,
  },
  range: { name: '远瞩', description: `攻击与护盾射程 +${buffDefinitions.range.valuePerLevel} 格` },
  slow: { name: '迟滞', description: `全场敌方移速 -${buffDefinitions.slow.valuePerLevel}%` },
  reward: {
    name: '丰收',
    description: `以后每次首次通关额外 +${buffDefinitions.reward.valuePerLevel} 灵钱`,
  },
  eagle_residue: {
    name: '剑意长留',
    description: `青锋隼的剑阵伤害 +${buffDefinitions.eagle_residue.valuePerLevel}%`,
  },
  boar_attack: {
    name: '岩甲重击',
    description: `岩甲豚的攻击伤害 +${buffDefinitions.boar_attack.valuePerLevel}%`,
  },
  bear_attack: {
    name: '拳意',
    description: `熊系攻击 +${buffDefinitions.bear_attack.valuePerLevel}%`,
  },
  fox_shield: {
    name: '灵盾',
    description: `月音狐的护盾量 +${buffDefinitions.fox_shield.valuePerLevel}%`,
  },
  mouse_finisher: {
    name: '追烬',
    description: `烬灵鼠对生命低于${buffDefinitions.mouse_finisher.thresholdHpPercent}%的敌人伤害 +${buffDefinitions.mouse_finisher.valuePerLevel}%`,
  },
  mouse_execute: {
    name: '终烬',
    description: `烬灵鼠有${buffDefinitions.mouse_execute.valuePerLevel}%概率斩杀残血非首领`,
  },
};
export function initialProgression(seed: number): Progression {
  return { level: 1, xp: 0, buffs: {}, rng: (seed ^ 0xa341316c) >>> 0 || 1 };
}
export function threshold(level: number): number {
  const values = config.progression.xpThresholdsForNextLevel;
  return (
    values[level - 1] ??
    values.at(-1)! + (level - values.length) * config.progression.afterThresholdsIncrement
  );
}
export function bonus(p: Progression, id: BuffId): number {
  return (p.buffs[id] ?? 0) * buffDefinitions[id].valuePerLevel;
}
export function gainExperience(p: Progression, amount: number): number {
  p.xp += amount;
  let levels = 0;
  while (p.xp >= threshold(p.level)) {
    p.xp -= threshold(p.level);
    p.level++;
    levels++;
  }
  return levels;
}
export function eligibleBuffs(p: Progression, units: Unit[], stageId: number): BuffId[] {
  return (Object.keys(buffDefinitions) as BuffId[]).filter((id) => {
    const b = buffDefinitions[id];
    if ((p.buffs[id] ?? 0) >= b.maxLevel || (b.minStage !== undefined && stageId < b.minStage))
      return false;
    if (b.requiresBuff && !p.buffs[b.requiresBuff as BuffId]) return false;
    if (
      b.requiresUnit &&
      !units.some(
        (u) => u.position && u.kind === b.requiresUnit && u.rank >= (b.requiresMinRank ?? 1),
      )
    )
      return false;
    return true;
  });
}
export function drawBuffs(p: Progression, units: Unit[], stageId: number): BuffId[] {
  const pool = eligibleBuffs(p, units, stageId);
  const result: BuffId[] = [];
  const qualityWeights = {
    common: config.progression.commonWeight,
    rare: config.progression.rareWeight,
    epic: config.progression.epicWeight,
  };
  while (pool.length && result.length < config.progression.buffOptions) {
    const qualities = (Object.keys(qualityWeights) as (keyof typeof qualityWeights)[]).filter((q) =>
      pool.some((id) => buffDefinitions[id].quality === q),
    );
    let roll = random(p) * qualities.reduce((n, q) => n + qualityWeights[q], 0);
    let quality = qualities.at(-1)!;
    for (const q of qualities) {
      roll -= qualityWeights[q];
      if (roll < 0) {
        quality = q;
        break;
      }
    }
    const available = pool.filter((id) => buffDefinitions[id].quality === quality);
    const selected = available[Math.floor(random(p) * available.length)];
    result.push(selected);
    pool.splice(pool.indexOf(selected), 1);
  }
  return result;
}
