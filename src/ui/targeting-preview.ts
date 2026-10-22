import { config, tauntValue, type HeroId, type Point } from '../game/content';
import { enemyTarget, maxHeroHp } from '../game/combat-skills';
import type { Ally } from '../game/combat-model';
import type { Preparation } from '../game/session';

export type TargetingEntry = {
  id: number;
  kind: HeroId;
  rank: number;
  position: Point;
  taunt: number;
  order: number;
};
export type TargetingRow = { row: number; units: TargetingEntry[] };
export type TargetingPreview = {
  column: number;
  reference: Point;
  rows: TargetingRow[];
  first: TargetingEntry | null;
};

export function targetingPreview(p: Preparation, requestedColumn: number): TargetingPreview {
  const column =
    Number.isInteger(requestedColumn) &&
    requestedColumn >= 0 &&
    requestedColumn < config.board.columns
      ? requestedColumn
      : config.waves.spawnColumns[0];
  const reference = { x: column + 0.5, y: config.waves.spawnRow };
  let remaining = p.units.flatMap((u): Ally[] => {
    if (!u.position) return [];
    const hp = maxHeroHp(u, p.progression);
    return [{ ...u, position: { ...u.position }, hp, maxHp: hp, cooldown: 0, ordinal: 0 }];
  });
  const rows: TargetingRow[] = [];
  let order = 0;
  // Keep the enemy at the reference point: this inspects priority, not future combat.
  while (remaining.length) {
    const target = enemyTarget(remaining, reference);
    if (!target) break;
    let row = rows.at(-1);
    if (!row || row.row !== target.position.y) {
      row = { row: target.position.y, units: [] };
      rows.push(row);
    }
    row.units.push({
      id: target.id,
      kind: target.kind,
      rank: target.rank,
      position: target.position,
      taunt: tauntValue(target.kind),
      order: ++order,
    });
    remaining = remaining.filter((u) => u.id !== target.id);
  }
  return { column, reference, rows, first: rows[0]?.units[0] ?? null };
}
