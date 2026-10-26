import type { Combat } from '../game/combat-model';
import type { Point } from '../game/content';
import type { Unit } from '../game/model';
import type { Preparation } from '../game/session';

type FallenUnit = Omit<Unit, 'position'> & { position: Point };
export type FirstFall = { at: number; units: FallenUnit[] };
export type DefeatFormationRow = {
  previous: FallenUnit;
  current: Unit | null;
  status: 'same' | 'moved' | 'reserve' | 'absent';
};

/** Undefined means unrecorded; null means recorded with no falls. */
export function firstFallSnapshot(battle: Combat): FirstFall | null | undefined {
  const falls = battle.report?.falls;
  if (!falls) return undefined;
  const batch = falls[0];
  if (!batch) return null;
  return {
    at: batch.at,
    units: batch.unitIds.map((id) => {
      const unit = battle.allies.find((ally) => ally.id === id)!;
      return { id: unit.id, kind: unit.kind, rank: unit.rank, position: { ...unit.position } };
    }),
  };
}

/** Identity survives upgrades, but never follows a consumed unit into its merge target. */
export function defeatFormation(
  p: Preparation,
  recap: { stageId: number; firstFall?: FirstFall | null },
): DefeatFormationRow[] {
  if (p.stageId !== recap.stageId || !recap.firstFall) return [];
  return recap.firstFall.units.map((previous) => {
    const unit = p.units.find((u) => u.id === previous.id && u.kind === previous.kind);
    let status: DefeatFormationRow['status'] = 'absent';
    if (unit) {
      if (!unit.position) status = 'reserve';
      else if (unit.position.x === previous.position.x && unit.position.y === previous.position.y)
        status = 'same';
      else status = 'moved';
    }
    return {
      previous: { ...previous, position: { ...previous.position } },
      current: unit ? { ...unit, position: unit.position ? { ...unit.position } : null } : null,
      status,
    };
  });
}
