import type { FormationPlan } from '../game/formation-presets';
import type { Preparation } from '../game/session';
import {
  foxSupport,
  type FoxSource,
  type FoxSupportModel,
  type FoxSupportUnit,
} from './fox-support';

export type FormationSupportChange = {
  id: number;
  before: FoxSupportUnit | null;
  after: FoxSupportUnit | null;
};
export type FormationSupportPreview = {
  before: FoxSupportModel;
  after: FoxSupportModel;
  changes: FormationSupportChange[];
};

// foxSupport returns each source list sorted by instance ID.
function sameSources(a: FoxSource[], b: FoxSource[]): boolean {
  return a.length === b.length && a.every((source, i) => source.id === b[i].id);
}

export function formationSupport(
  preparation: Preparation,
  plan: FormationPlan | null,
): FormationSupportPreview | null {
  if (!plan || 'error' in plan) return null;
  const before = foxSupport(preparation);
  const after = foxSupport({ ...preparation, units: plan.units });
  const current = new Map(before.units.map((u) => [u.id, u]));
  const planned = new Map(after.units.map((u) => [u.id, u]));
  const ids = [...new Set([...current.keys(), ...planned.keys()])].sort((a, b) => a - b);
  const changes = ids.flatMap((id): FormationSupportChange[] => {
    const a = current.get(id) ?? null;
    const b = planned.get(id) ?? null;
    if (
      a &&
      b &&
      a.front === b.front &&
      sameSources(a.shieldSources, b.shieldSources) &&
      sameSources(a.auraSources, b.auraSources)
    )
      return [];
    return [{ id, before: a, after: b }];
  });
  return { before, after, changes };
}
