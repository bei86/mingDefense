import type { Ally, Combat } from '../game/combat-model';
import { appearances, heroes } from '../game/content';

export type FormationMoment = {
  key: string;
  label: string;
  at: number;
  batchCount?: number;
};
export type FormationState = 'standing' | 'fallen' | 'newly-fallen';
export const formationStateLabels: Record<FormationState, string> = {
  standing: '仍在阵',
  fallen: '已重伤',
  'newly-fallen': '本批重伤',
};
export type FormationUnit = Pick<Ally, 'id' | 'kind' | 'rank' | 'position'> & {
  label: string;
  state: FormationState;
  width: number;
  height: number;
};
export type BattleFormationView = {
  moments: FormationMoment[];
  selected: FormationMoment;
  historyRecorded: boolean;
  units: FormationUnit[];
  standing: number;
  fallen: number;
};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}秒`;
}

/** Reconstruct only presence on the line, never historical HP or combat actions. */
export function battleFormation(
  battle: Combat | null,
  pointKey: string,
): BattleFormationView | null {
  if (!battle?.result) return null;
  const falls = battle.report?.falls;
  const end: FormationMoment = {
    key: 'end',
    label: `战斗结束 · ${seconds(battle.time)}`,
    at: battle.time,
  };
  const moments: FormationMoment[] = [];
  if (falls) {
    moments.push({ key: 'start', label: '开战时 · 0.00秒', at: 0, batchCount: 0 });
    falls.forEach((batch, i) =>
      moments.push({
        key: `fall-${i}`,
        label: `第${i + 1}批重伤后 · ${seconds(batch.at)}`,
        at: batch.at,
        batchCount: i + 1,
      }),
    );
  }
  moments.push(end);
  const selected = moments.find((moment) => moment.key === pointKey) ?? end;
  const batchCount = selected.batchCount ?? 0;
  const fallenIds = new Set(falls?.slice(0, batchCount).flatMap((batch) => batch.unitIds));
  const latestIds = new Set(falls?.[batchCount - 1]?.unitIds);
  const units = battle.allies
    .map((ally): FormationUnit => {
      let state: FormationState = 'standing';
      if (selected.key === 'end') {
        if (ally.hp <= 0) state = 'fallen';
      } else if (latestIds.has(ally.id)) state = 'newly-fallen';
      else if (fallenIds.has(ally.id)) state = 'fallen';
      const shape = heroes[ally.kind].shape;
      return {
        id: ally.id,
        kind: ally.kind,
        rank: ally.rank,
        position: { ...ally.position },
        state,
        label: `${appearances[ally.kind].name} ${ally.rank}阶（${ally.position.x + 1}列${ally.position.y + 1}行）`,
        width: Math.max(...shape.map(([x]) => x)) + 1,
        height: Math.max(...shape.map(([, y]) => y)) + 1,
      };
    })
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id);
  const standing = units.filter((unit) => unit.state === 'standing').length;
  return {
    moments,
    selected,
    historyRecorded: falls !== undefined,
    units,
    standing,
    fallen: units.length - standing,
  };
}
