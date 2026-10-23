import { placementError, swapError, unitAt, type Session } from '../session';
import type { BattleSample } from './campaign-simulation';

/** A declared, local placement heuristic, never an optimal-play claim. */
export function protectPeaches(s: Session): number {
  if (s.phase !== 'prepare') return 0;
  let moves = 0;
  const points = s.preparation.unlocked
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const peach of [...s.preparation.units]
    .filter((u) => u.kind === 'fortune_peach' && u.position)
    .sort((a, b) => a.id - b.id)) {
    for (const point of points) {
      if (point.y <= peach.position!.y) continue;
      if (!placementError(s.preparation, peach.kind, point, peach.id)) {
        const error = s.transfer({ type: 'unit', id: peach.id }, point);
        if (error) throw Error(error);
        moves++;
        break;
      }
      const target = unitAt(s.preparation, point);
      if (
        !target ||
        target.kind === 'fortune_peach' ||
        target.position?.x !== point.x ||
        target.position.y !== point.y ||
        swapError(s.preparation, peach.id, target.id)
      )
        continue;
      const error = s.swap(peach.id, target.id);
      if (error) throw Error(error);
      moves++;
      break;
    }
  }
  return moves;
}

export type AuditRun = {
  seed: number;
  policy: string;
  boost: boolean;
  variant: string;
  group: 'historical' | 'holdout';
  complete: boolean;
  results: BattleSample[];
};

function groupKey(r: AuditRun): string {
  return [r.variant, r.policy, r.boost, r.group].join(':');
}
function failureReason(b: BattleSample): 'wiped' | 'timeout' | 'other' {
  if (b.hp <= 0) return 'wiped';
  if (b.time >= 180000) return 'timeout';
  return 'other';
}
const wonCount = (r: AuditRun) => r.results.filter((b) => b.result === 'victory').length;

export function summarizeCampaignRuns(runs: readonly AuditRun[], targetStage = 50) {
  const groups = new Map<string, AuditRun[]>();
  for (const r of runs) {
    const key = groupKey(r);
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  return [...groups.values()].map((rows) => {
    const { variant, policy, boost, group } = rows[0];
    const failedAt: Record<string, number> = {};
    const firstDeaths: Record<string, number> = {};
    const failureReasons = { wiped: 0, timeout: 0, other: 0 };
    for (const row of rows) {
      const last = row.results.at(-1)!;
      if (last.result === 'defeat') {
        failedAt[last.stage] = (failedAt[last.stage] ?? 0) + 1;
        failureReasons[failureReason(last)]++;
        const kind = last.audit?.firstDeath?.kind;
        if (kind) firstDeaths[kind] = (firstDeaths[kind] ?? 0) + 1;
      }
    }
    const stages = Array.from({ length: targetStage }, (_, i) => {
      const battles = rows.flatMap((r) => r.results.filter((b) => b.stage === i + 1));
      return {
        stage: i + 1,
        reached: battles.length,
        won: battles.filter((b) => b.result === 'victory').length,
        failed: battles.filter((b) => b.result === 'defeat').length,
        meanTime: battles.length ? battles.reduce((n, b) => n + b.time, 0) / battles.length : null,
        meanEndHpRatio: battles.length
          ? battles.reduce((n, b) => n + b.hpRatio, 0) / battles.length
          : null,
      };
    });
    return {
      variant,
      policy,
      boost,
      group,
      runs: rows.length,
      complete: rows.filter((r) => r.complete).length,
      meanCompleted: rows.reduce((n, r) => n + wonCount(r), 0) / rows.length,
      failedAt,
      failureReasons,
      firstDeaths,
      stages,
    };
  });
}

export function compareCampaignRuns(runs: readonly AuditRun[]) {
  const variants = new Map<string, Map<string, AuditRun>>();
  for (const r of runs) {
    const key = [r.seed, r.policy, r.boost, r.group].join(':');
    const map = variants.get(r.variant) ?? new Map<string, AuditRun>();
    if (map.has(key)) throw Error('重复配对路线');
    map.set(key, r);
    variants.set(r.variant, map);
  }
  if (!runs.length) return [];
  const baseline = variants.get('baseline');
  if (!baseline) throw Error('缺少基线配对路线');
  const result = new Map<
    string,
    {
      variant: string;
      policy: string;
      boost: boolean;
      group: AuditRun['group'];
      pairs: number;
      improved: number;
      regressed: number;
      unchanged: number;
      deltaCompleted: number;
    }
  >();
  for (const [variant, map] of variants) {
    if (variant === 'baseline') continue;
    if (map.size !== baseline.size || [...baseline.keys()].some((k) => !map.has(k)))
      throw Error('配对路线不完整');
    for (const [key, row] of map) {
      const delta = wonCount(row) - wonCount(baseline.get(key)!);
      const group = groupKey(row);
      const summary = result.get(group) ?? {
        variant,
        policy: row.policy,
        boost: row.boost,
        group: row.group,
        pairs: 0,
        improved: 0,
        regressed: 0,
        unchanged: 0,
        deltaCompleted: 0,
      };
      summary.pairs++;
      summary.deltaCompleted += delta;
      if (delta > 0) summary.improved++;
      else if (delta < 0) summary.regressed++;
      else summary.unchanged++;
      result.set(group, summary);
    }
  }
  return [...result.values()];
}
