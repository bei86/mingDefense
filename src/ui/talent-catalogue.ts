import { appearances, type HeroId } from '../game/content';
import type { BuffId } from '../game/model';
import { buffDefinitions, buffLabels, eligibleBuffs } from '../game/progression';
import type { Session } from '../game/session';
import { talentCondition } from './talent-effects';

export type TalentCatalogueEntry = {
  id: BuffId;
  level: number;
  maxLevel: number;
  requirements: string[];
  blockers: string[];
  eligible: boolean;
  maxed: boolean;
  note: string;
};

/** Inspect the existing pool rules without drawing, choosing or changing progression. */
export function talentCatalogue(session: Session): TalentCatalogueEntry[] {
  const progression = session.battle?.progression ?? session.preparation.progression;
  const units = session.battle?.allies ?? session.preparation.units;
  const stageId = session.battle?.stageId ?? session.preparation.stageId;
  const eligible = new Set(eligibleBuffs(progression, units, stageId));
  return (Object.keys(buffDefinitions) as BuffId[]).map((id) => {
    const definition = buffDefinitions[id];
    const requirements: string[] = [];
    const blockers: string[] = [];
    function requirement(label: string, met: boolean): void {
      requirements.push(label);
      if (!met) blockers.push(label);
    }
    if (definition.minStage !== undefined)
      requirement(`第${definition.minStage}关起`, stageId >= definition.minStage);
    if (definition.requiresBuff) {
      const prerequisite = definition.requiresBuff as BuffId;
      requirement(`先获得「${buffLabels[prerequisite].name}」`, !!progression.buffs[prerequisite]);
    }
    if (definition.requiresUnit) {
      const kind = definition.requiresUnit as HeroId;
      const minRank = definition.requiresMinRank ?? 1;
      const rankLabel = minRank > 1 ? `${minRank}阶起，` : '';
      requirement(
        `上阵${appearances[kind].name}（${rankLabel}备战不计）`,
        units.some((unit) => unit.position !== null && unit.kind === kind && unit.rank >= minRank),
      );
    }
    const level = progression.buffs[id] ?? 0;
    return {
      id,
      level,
      maxLevel: definition.maxLevel,
      requirements,
      blockers,
      eligible: eligible.has(id),
      maxed: level >= definition.maxLevel,
      note: talentCondition(id),
    };
  });
}
