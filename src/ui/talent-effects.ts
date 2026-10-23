import { appearances, config, type HeroId } from '../game/content';
import type { Combat } from '../game/combat-model';
import type { BuffId } from '../game/model';
import { buffDefinitions } from '../game/progression';

export function talentContribution(id: BuffId, value: number): string {
  const amount = String(Number(value.toFixed(2)));
  switch (id) {
    case 'range':
      return `+${amount} 格`;
    case 'reward':
      return `+${amount} 灵钱`;
    case 'monkey_vulnerability':
      return `+${amount} 个百分点`;
    case 'mouse_execute':
      return `${amount}% 概率`;
    case 'slow':
      return value === 0 ? '0%' : `-${amount}%`;
    default:
      return `+${amount}%`;
  }
}

export function talentBattleScope(battle: Combat, id: BuffId): string {
  const definition = buffDefinitions[id];
  const kind = definition.requiresUnit as HeroId | undefined;
  if (kind) {
    const minRank = definition.requiresMinRank ?? 1;
    const casters = battle.allies.filter((ally) => ally.kind === kind && ally.rank >= minRank);
    const living = casters.filter((ally) => ally.hp > 0).length;
    const fallen = casters.length - living;
    const rank = minRank > 1 ? ` ${minRank}阶起` : '';
    const state = living ? `存活施放者 ${living}只` : '当前无存活施放者';
    const dead = fallen ? `（另有${fallen}只倒下）` : '';
    return `${appearances[kind].name}${rank} · ${state}${dead}`;
  }
  const living = battle.allies.filter((ally) => ally.hp > 0);
  switch (id) {
    case 'attack':
      return `存活输出灵兽 ${living.filter((ally) => !['fortune_peach', 'shield_fox'].includes(ally.kind)).length}只`;
    case 'attack_speed':
    case 'range':
      return `存活攻击/施盾灵兽 ${living.filter((ally) => ally.kind !== 'fortune_peach').length}只`;
    case 'health':
      return `存活灵兽 ${living.length}只`;
    case 'slow':
      return '全场敌方移速';
    case 'reward':
      return '首次通关结算';
    default:
      return '';
  }
}

export function talentCondition(id: BuffId): string {
  switch (id) {
    case 'attack':
    case 'boar_attack':
    case 'bear_attack':
      return '与其他攻击加成叠加，不等于最终伤害。';
    case 'attack_speed':
      return `与聚灵叠加，攻速加成最多 +${config.damage.attackSpeedBonusCapPercent}%。`;
    case 'health':
      return '存活者补足上限增量，倒下不复活。';
    case 'range':
      return '增加攻击与施盾射程，桃的产钱间隔不变。';
    case 'slow':
      return `与霜尾缓行叠加，移速最多降低${config.damage.slowCapPercent}%。`;
    case 'reward':
      return '按首次通关结算，不是立即领取灵钱。';
    case 'eagle_residue':
      return '仅影响新生成剑阵，已有剑阵不回算。';
    case 'monkey_vulnerability':
      return '增加新施加的易伤幅度，不延长持续时间。';
    case 'fox_shield':
      return '提高施盾量，仍受目标护盾上限约束。';
    case 'mouse_finisher':
      return `仅对生命低于${buffDefinitions.mouse_finisher.thresholdHpPercent}%的敌人生效。`;
    case 'mouse_execute':
      return `仅对生命低于${buffDefinitions.mouse_execute.thresholdHpPercent}%的非首领，按概率触发。`;
  }
}
