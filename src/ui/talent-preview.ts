import type { Combat } from '../game/combat-model';
import { maxHeroHp } from '../game/combat-skills';
import type { BuffId } from '../game/model';
import { bonus, buffDefinitions } from '../game/progression';
import { talentBattleScope, talentCondition, talentContribution } from './talent-effects';

export type TalentPreviewModel = {
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  before: string;
  after: string;
  scope: string;
  note: string;
  healthGain: number | null;
};

/** Compare this offered talent's contribution without choosing it or advancing RNG/time. */
export function talentPreview(battle: Combat | null, id: BuffId): TalentPreviewModel | null {
  if (!battle || !battle.choices.includes(id)) return null;
  const definition = buffDefinitions[id];
  const currentLevel = battle.progression.buffs[id] ?? 0;
  if (currentLevel >= definition.maxLevel) return null;
  const nextLevel = currentLevel + 1;
  const nextProgression = {
    ...battle.progression,
    buffs: { ...battle.progression.buffs, [id]: nextLevel },
  };
  let healthGain: number | null = null;
  if (id === 'health') {
    healthGain = battle.allies
      .filter((ally) => ally.hp > 0)
      .reduce((total, ally) => total + maxHeroHp(ally, nextProgression) - ally.maxHp, 0);
  }
  return {
    currentLevel,
    nextLevel,
    maxLevel: definition.maxLevel,
    before: talentContribution(id, bonus(battle.progression, id)),
    after: talentContribution(id, bonus(nextProgression, id)),
    scope: talentBattleScope(battle, id),
    note: talentCondition(id),
    healthGain,
  };
}
