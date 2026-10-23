import type { HeroId, Point } from '../game/content';
import type { FormationPlan } from '../game/formation-presets';
import type { Unit } from '../game/model';

export type FormationChangesView = {
  moved: number;
  deployed: number;
  reserved: number;
  units: { id: number; kind: HeroId; rank: number; from: Point | null; to: Point | null }[];
};

/** Compare a successful plan for this roster; matching belongs to planFormation. */
export function formationChanges(
  current: readonly Unit[],
  plan: FormationPlan | null,
): FormationChangesView | null {
  if (!plan || 'error' in plan) return null;
  const targets = new Map(plan.units.map((unit) => [unit.id, unit]));
  const view: FormationChangesView = { moved: 0, deployed: 0, reserved: 0, units: [] };
  for (const unit of current) {
    const from = unit.position;
    const to = targets.get(unit.id)!.position;
    if (from?.x === to?.x && from?.y === to?.y) continue;
    if (from === null) view.deployed++;
    else if (to === null) view.reserved++;
    else view.moved++;
    view.units.push({
      id: unit.id,
      kind: unit.kind,
      rank: unit.rank,
      from: from ? { ...from } : null,
      to: to ? { ...to } : null,
    });
  }
  return view.units.length ? view : null;
}

export function formationPositionLabel(position: Point | null): string {
  return position ? `${position.x + 1}列${position.y + 1}行` : '备战席';
}
