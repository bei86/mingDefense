import { stages, type Stage } from '../content';
import type { BattleSample } from './campaign-battle';

export type RangedPressureVariant = 'baseline' | 'stage8' | 'stage14' | 'both';

/** Synchronous experiment only; never keep a candidate active across an await. */
export function withRangedPressure<T>(variant: RangedPressureVariant, run: () => T): T {
  const selected = stages.filter(
    (s) =>
      (s.id === 8 && (variant === 'stage8' || variant === 'both')) ||
      (s.id === 14 && (variant === 'stage14' || variant === 'both')),
  );
  const changed: { wave: Stage['waves'][number]; enemies: Stage['waves'][number]['enemies'] }[] =
    [];
  try {
    for (const stage of selected) {
      for (const wave of stage.waves) {
        if (!wave.enemies.ranged) continue;
        changed.push({ wave, enemies: wave.enemies });
        wave.enemies = {
          ...wave.enemies,
          ranged: wave.enemies.ranged - 1,
          wolf: (wave.enemies.wolf ?? 0) + 1,
        };
      }
    }
    return run();
  } finally {
    for (const { wave, enemies } of changed) wave.enemies = enemies;
  }
}

export type PressureReplay = {
  seed: number;
  policy: string;
  boost: boolean;
  group: 'historical' | 'holdout';
  stage: 8 | 14;
  variant: Exclude<RangedPressureVariant, 'both'>;
  battle: Pick<BattleSample, 'result' | 'time' | 'hpRatio'>;
};
export type PressurePairSummary = {
  group: PressureReplay['group'];
  stage: PressureReplay['stage'];
  pairs: number;
  rescued: number;
  lost: number;
  bothWon: number;
  bothLost: number;
  sameWinTimeDelta: number;
  sameWinHpDelta: number;
};

export function summarizePressureReplays(rows: readonly PressureReplay[]): PressurePairSummary[] {
  const pairs = new Map<string, { baseline?: PressureReplay; candidate?: PressureReplay }>();
  for (const row of rows) {
    if (row.variant !== 'baseline' && row.variant !== `stage${row.stage}`)
      throw Error('局部候选与关卡不匹配');
    const key = [row.seed, row.policy, row.boost, row.group, row.stage].join(':');
    const pair = pairs.get(key) ?? {};
    const side = row.variant === 'baseline' ? 'baseline' : 'candidate';
    if (pair[side]) throw Error('重复局部配对');
    pair[side] = row;
    pairs.set(key, pair);
  }
  const summaries = new Map<string, PressurePairSummary>();
  for (const { baseline, candidate } of pairs.values()) {
    if (!baseline || !candidate) throw Error('局部配对不完整');
    const key = `${baseline.group}:${baseline.stage}`;
    let summary = summaries.get(key);
    if (!summary) {
      summary = {
        group: baseline.group,
        stage: baseline.stage,
        pairs: 0,
        rescued: 0,
        lost: 0,
        bothWon: 0,
        bothLost: 0,
        sameWinTimeDelta: 0,
        sameWinHpDelta: 0,
      };
      summaries.set(key, summary);
    }
    summary.pairs++;
    const wasWon = baseline.battle.result === 'victory';
    const nowWon = candidate.battle.result === 'victory';
    if (wasWon && nowWon) {
      summary.bothWon++;
      summary.sameWinTimeDelta += candidate.battle.time - baseline.battle.time;
      summary.sameWinHpDelta += candidate.battle.hpRatio - baseline.battle.hpRatio;
    } else if (wasWon) summary.lost++;
    else if (nowWon) summary.rescued++;
    else summary.bothLost++;
  }
  return [...summaries.values()].sort(
    (a, b) => a.group.localeCompare(b.group) || a.stage - b.stage,
  );
}
