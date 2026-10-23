import { center, clone, distance, heroes, type Point } from '../content';
import { heroRange } from '../combat-skills';
import {
  Session,
  placementError,
  swapError,
  unitAt,
  type Preparation,
  type SessionSave,
} from '../session';
import { validSave } from '../persistence';
import { orders } from './campaign-simulation';
import { runPreparedBattle, type BattleSample } from './campaign-battle';

export type FormationVariant = 'baseline' | 'reserves' | 'fox' | 'combined';
export type FormationReplay = {
  opening: SessionSave;
  actions: FormationAction[];
  coverage: FoxCoverage;
  battle: BattleSample;
  outputDeaths: number;
  firstOutputDeath: number | null;
  shieldGiven: number;
  shieldAbsorbed: number;
};
export type FormationAction = {
  action: 'swap' | 'move';
  id: number;
  targetId?: number;
  from: Point | null;
  to: Point;
};

function swap(s: Session, id: number, targetId: number): FormationAction {
  const source = s.preparation.units.find((u) => u.id === id)!;
  const target = s.preparation.units.find((u) => u.id === targetId)!;
  const action: FormationAction = {
    action: 'swap',
    id,
    targetId,
    from: clone(source.position),
    to: clone(target.position!),
  };
  const error = s.swap(id, targetId);
  if (error) throw Error(error);
  return action;
}

/** Only compare ranks within one species; never trial a battle to select a swap. */
export function replaceReserves(s: Session): FormationAction[] {
  if (s.phase !== 'prepare') return [];
  const actions: FormationAction[] = [];
  const reserves = s.preparation.units
    .filter((u) => !u.position)
    .sort((a, b) => b.rank - a.rank || a.id - b.id);
  for (const reserve of reserves) {
    const target = s.preparation.units
      .filter((u) => u.position && u.kind === reserve.kind && u.rank < reserve.rank)
      .sort((a, b) => a.rank - b.rank || a.id - b.id)
      .find((u) => !swapError(s.preparation, reserve.id, u.id));
    if (target) actions.push(swap(s, reserve.id, target.id));
  }
  return actions;
}

export type FoxCoverage = { auraTargets: number; shieldableFront: number };

/** Static opening coverage, not damage, shielding throughput, or survival prediction. */
export function foxCoverage(p: Preparation): FoxCoverage {
  const deployed = p.units.filter((u) => u.position);
  const foxes = deployed.filter((u) => u.kind === 'shield_fox');
  const skill = heroes.shield_fox.skills;
  const frontRow = Math.min(...deployed.map((u) => u.position!.y));
  return {
    auraTargets: deployed.filter(
      (u) =>
        u.kind !== 'fortune_peach' &&
        u.kind !== 'shield_fox' &&
        foxes.some(
          (fox) =>
            fox.rank >= skill.auraFromRank! &&
            distance(center(fox.kind, fox.position!), center(u.kind, u.position!)) <=
              skill.auraRadiusCells!,
        ),
    ).length,
    shieldableFront: deployed.filter(
      (u) =>
        u.position!.y === frontRow &&
        foxes.some(
          (fox) =>
            distance(center(fox.kind, fox.position!), center(u.kind, u.position!)) <=
            heroRange(fox, p.progression),
        ),
    ).length,
  };
}

function better(a: FoxCoverage, b: FoxCoverage): boolean {
  return (
    a.auraTargets > b.auraTargets ||
    (a.auraTargets === b.auraTargets && a.shieldableFront > b.shieldableFront)
  );
}

export function improveFoxCoverage(s: Session): FormationAction[] {
  if (s.phase !== 'prepare') return [];
  const actions: FormationAction[] = [];
  const foxes = s.preparation.units
    .filter((u) => u.position && u.kind === 'shield_fox')
    .sort((a, b) => a.id - b.id);
  const points = s.preparation.unlocked
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const fox of foxes) {
    const current = s.preparation.units.find((u) => u.id === fox.id)!;
    let bestScore = foxCoverage(s.preparation);
    let best: { point: Point; targetId?: number } | undefined;
    for (const point of points) {
      let targetId: number | undefined;
      if (placementError(s.preparation, current.kind, point, current.id)) {
        const target = unitAt(s.preparation, point);
        if (
          !target ||
          target.kind === 'shield_fox' ||
          target.position?.x !== point.x ||
          target.position.y !== point.y ||
          swapError(s.preparation, current.id, target.id)
        )
          continue;
        targetId = target.id;
      }
      const draft = {
        ...s.preparation,
        units: s.preparation.units.map((u) => {
          if (u.id === current.id) return { ...u, position: point };
          if (u.id === targetId) return { ...u, position: current.position };
          return u;
        }),
      };
      const score = foxCoverage(draft);
      if (better(score, bestScore)) {
        bestScore = score;
        best = { point, targetId };
      }
    }
    if (!best) continue;
    if (best.targetId !== undefined) actions.push(swap(s, current.id, best.targetId));
    else {
      const action: FormationAction = {
        action: 'move',
        id: current.id,
        from: clone(current.position),
        to: { ...best.point },
      };
      const error = s.transfer({ type: 'unit', id: current.id }, best.point);
      if (error) throw Error(error);
      actions.push(action);
    }
  }
  return actions;
}

export function replayFormation(
  save: SessionSave,
  policy: string,
  boost: boolean,
  variant: FormationVariant,
): FormationReplay {
  if (!validSave(save) || save.phase !== 'prepare') throw Error('需要合法整备检查点');
  if (!Object.hasOwn(orders, policy)) throw Error('未知领取策略');
  if (!['baseline', 'reserves', 'fox', 'combined'].includes(variant)) throw Error('未知布阵实验');
  const s = Session.restore(save);
  const actions: FormationAction[] = [];
  if (variant === 'reserves' || variant === 'combined') actions.push(...replaceReserves(s));
  if (variant === 'fox' || variant === 'combined') actions.push(...improveFoxCoverage(s));
  const opening = s.exportSave();
  const coverage = foxCoverage(s.preparation);
  const battle = runPreparedBattle(s, policy, boost, false, { audit: true, allDeaths: true });
  const outputDeaths = battle.audit!.deaths!.filter(
    (u) => u.kind !== 'fortune_peach' && u.kind !== 'shield_fox',
  );
  return {
    opening,
    actions,
    coverage,
    battle,
    outputDeaths: outputDeaths.length,
    firstOutputDeath: outputDeaths[0]?.time ?? null,
    shieldGiven: battle.report!.units.reduce((n, u) => n + u.shieldGiven, 0),
    shieldAbsorbed: battle.report!.units.reduce((n, u) => n + u.shieldAbsorbed, 0),
  };
}

export type FormationReplayRow = FormationReplay & {
  seed: number;
  policy: string;
  boost: boolean;
  variant: FormationVariant;
  group: 'historical' | 'validation';
};

export type FormationReplaySummary = {
  stage: number;
  policy: string;
  boost: boolean;
  variant: FormationVariant;
  group: FormationReplayRow['group'];
  pairs: number;
  rescued: number;
  lost: number;
  bothWon: number;
  bothLost: number;
  changed: number;
  sameWinTimeDelta: number;
  sameWinHpDelta: number;
};

export function summarizeFormationReplays(
  rows: readonly FormationReplayRow[],
): FormationReplaySummary[] {
  const variants = new Map<string, Map<string, FormationReplayRow>>();
  for (const row of rows) {
    const key = [row.seed, row.policy, row.boost, row.group, row.battle.stage].join(':');
    const map = variants.get(row.variant) ?? new Map<string, FormationReplayRow>();
    if (map.has(key)) throw Error('重复配对');
    map.set(key, row);
    variants.set(row.variant, map);
  }
  if (!rows.length) return [];
  const baseline = variants.get('baseline');
  if (!baseline) throw Error('缺少原阵配对');
  const summaries = new Map<string, FormationReplaySummary>();
  for (const [variant, map] of variants) {
    if (variant === 'baseline') continue;
    if (map.size !== baseline.size || [...baseline.keys()].some((key) => !map.has(key)))
      throw Error('配对不完整');
    for (const [key, row] of map) {
      const base = baseline.get(key)!;
      const group = [row.battle.stage, row.policy, row.boost, row.group, variant].join(':');
      const summary = summaries.get(group) ?? {
        stage: row.battle.stage,
        policy: row.policy,
        boost: row.boost,
        variant: row.variant,
        group: row.group,
        pairs: 0,
        rescued: 0,
        lost: 0,
        bothWon: 0,
        bothLost: 0,
        changed: 0,
        sameWinTimeDelta: 0,
        sameWinHpDelta: 0,
      };
      summary.pairs++;
      if (row.actions.length) summary.changed++;
      const won = row.battle.result === 'victory';
      const baseWon = base.battle.result === 'victory';
      if (won && !baseWon) summary.rescued++;
      else if (!won && baseWon) summary.lost++;
      else if (won) {
        summary.bothWon++;
        summary.sameWinTimeDelta += row.battle.time - base.battle.time;
        summary.sameWinHpDelta += row.battle.hpRatio - base.battle.hpRatio;
      } else summary.bothLost++;
      summaries.set(group, summary);
    }
  }
  return [...summaries.values()];
}
