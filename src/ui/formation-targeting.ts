import { config } from '../game/content';
import type { FormationPlan } from '../game/formation-presets';
import type { Preparation } from '../game/session';
import { targetingPreview, type TargetingEntry } from './targeting-preview';

export type FormationTargetingEntry = {
  column: number;
  before: TargetingEntry | null;
  after: TargetingEntry | null;
};

export function formationTargeting(
  p: Preparation,
  plan: FormationPlan | null,
): FormationTargetingEntry[] | null {
  if (!plan || 'error' in plan) return null;
  const planned = { ...p, units: plan.units };
  return config.waves.spawnColumns.map((column) => ({
    column,
    before: targetingPreview(p, column).first,
    after: targetingPreview(planned, column).first,
  }));
}
