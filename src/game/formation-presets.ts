import { appearances, cells, config, heroIds, key, type HeroId, type Point } from './content';
import type { Unit } from './model';
import type { Preparation } from './session';

export type FormationPreset = {
  units: { kind: HeroId; rank: number; position: Point | null }[];
};
export type FormationRosterDifference = {
  missing: { kind: HeroId; rank: number; count: number }[];
  extra: { kind: HeroId; rank: number; count: number }[];
};
export type FormationPlan =
  | { error: string; difference?: FormationRosterDifference }
  | { units: Unit[] };

function rosterDifference(
  units: readonly Unit[],
  preset: FormationPreset,
): FormationRosterDifference {
  const counts = new Map<string, number>();
  for (const unit of preset.units) {
    const group = `${unit.kind}:${unit.rank}`;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  for (const unit of units) {
    const group = `${unit.kind}:${unit.rank}`;
    counts.set(group, (counts.get(group) ?? 0) - 1);
  }
  const difference: FormationRosterDifference = { missing: [], extra: [] };
  for (const kind of heroIds) {
    for (let rank = 1; rank <= 6; rank++) {
      const count = counts.get(`${kind}:${rank}`) ?? 0;
      if (count > 0) difference.missing.push({ kind, rank, count });
      if (count < 0) difference.extra.push({ kind, rank, count: -count });
    }
  }
  return difference;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validFormation(value: unknown): value is FormationPreset {
  if (
    !record(value) ||
    !Array.isArray(value.units) ||
    !value.units.length ||
    value.units.length > config.board.columns * config.board.rows + config.board.reserveUnitLimit
  )
    return false;
  const occupied = new Set<string>();
  let reserves = 0;
  for (const unit of value.units) {
    if (
      !record(unit) ||
      !heroIds.includes(unit.kind as HeroId) ||
      !Number.isInteger(unit.rank) ||
      (unit.rank as number) < 1 ||
      (unit.rank as number) > 6
    )
      return false;
    if (unit.position === null) {
      reserves++;
      continue;
    }
    const position = unit.position;
    if (!record(position) || !Number.isInteger(position.x) || !Number.isInteger(position.y))
      return false;
    for (const cell of cells(unit.kind as HeroId, position as Point)) {
      if (
        cell.x < 0 ||
        cell.x >= config.board.columns ||
        cell.y < 0 ||
        cell.y >= config.board.rows ||
        occupied.has(key(cell))
      )
        return false;
      occupied.add(key(cell));
    }
  }
  return occupied.size > 0 && reserves <= config.board.reserveUnitLimit;
}

export function captureFormation(units: readonly Unit[]): FormationPreset {
  return {
    units: [...units]
      .sort((a, b) => a.id - b.id)
      .map(({ kind, rank, position }) => ({
        kind,
        rank,
        position: position ? { ...position } : null,
      })),
  };
}

/** Match only owned units, then validate the entire final layout before applying anything. */
export function planFormation(
  p: Pick<Preparation, 'units' | 'unlocked'>,
  preset: unknown,
): FormationPlan {
  if (!validFormation(preset)) return { error: '阵型数据无效，请重新保存' };
  const mismatch = '灵兽种类、阶数或数量已变化，请重新保存阵型';
  const difference = rosterDifference(p.units, preset);
  if (difference.missing.length || difference.extra.length) return { error: mismatch, difference };
  const remaining = [...p.units].sort((a, b) => a.id - b.id);
  const positions = new Map<number, Point | null>();
  for (const entry of preset.units) {
    const index = remaining.findIndex(
      (unit) => unit.kind === entry.kind && unit.rank === entry.rank,
    );
    if (index < 0) return { error: mismatch };
    const [unit] = remaining.splice(index, 1);
    if (
      entry.position &&
      cells(entry.kind, entry.position).some((cell) => !p.unlocked.includes(key(cell)))
    )
      return { error: `${appearances[entry.kind].name}的预设位置尚未完整解锁` };
    positions.set(unit.id, entry.position ? { ...entry.position } : null);
  }
  const units = p.units.map((unit) => ({ ...unit, position: positions.get(unit.id)! }));
  if (
    units.every(
      (unit, i) =>
        unit.position?.x === p.units[i].position?.x && unit.position?.y === p.units[i].position?.y,
    )
  )
    return { error: '当前已是这套站位' };
  return { units };
}
