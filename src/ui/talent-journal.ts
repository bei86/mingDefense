import { appearances, type HeroId } from '../game/content';
import type { BuffId, Unit } from '../game/model';
import { bonus, buffDefinitions } from '../game/progression';
import type { Session } from '../game/session';
import { talentBattleScope, talentCondition, talentContribution } from './talent-effects';

export type TalentJournalEntry = {
  id: BuffId;
  level: number;
  maxLevel: number;
  contribution: string;
  scope: string;
  note: string;
};

function preparationScope(units: Unit[], id: BuffId): string {
  if (id === 'slow') return '全场敌方移速';
  if (id === 'reward') return '首次通关结算';

  const definition = buffDefinitions[id];
  const kind = definition.requiresUnit as HeroId | undefined;
  let label = '灵兽';
  let eligible = units;
  if (kind) {
    const minRank = definition.requiresMinRank ?? 1;
    label = `${appearances[kind].name}${minRank > 1 ? ` ${minRank}阶起` : ''}`;
    eligible = units.filter((unit) => unit.kind === kind && unit.rank >= minRank);
  } else if (id === 'attack') {
    label = '输出灵兽';
    eligible = units.filter((unit) => !['fortune_peach', 'shield_fox'].includes(unit.kind));
  } else if (id === 'attack_speed' || id === 'range') {
    label = '攻击/施盾灵兽';
    eligible = units.filter((unit) => unit.kind !== 'fortune_peach');
  }
  const deployed = eligible.filter((unit) => unit.position !== null).length;
  const reserve = eligible.length - deployed;
  return `${label} · 已上阵 ${deployed}只${reserve ? ` · 备战 ${reserve}只（需上阵）` : ''}`;
}

/** Read acquired talents independently of the current choice pool, including maxed talents. */
export function talentJournal(session: Session): TalentJournalEntry[] {
  const battle = session.battle;
  const progression = battle?.progression ?? session.preparation.progression;
  return (Object.keys(buffDefinitions) as BuffId[]).flatMap((id) => {
    const level = progression.buffs[id] ?? 0;
    if (level <= 0) return [];
    return [
      {
        id,
        level,
        maxLevel: buffDefinitions[id].maxLevel,
        contribution: talentContribution(id, bonus(progression, id)),
        scope: battle
          ? talentBattleScope(battle, id)
          : preparationScope(session.preparation.units, id),
        note: talentCondition(id),
      },
    ];
  });
}
