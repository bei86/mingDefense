import { appearances, clone, config } from '../game/content';
import type { Progression } from '../game/model';
import { buffDefinitions, buffLabels } from '../game/progression';
import { validSave, type StoragePort } from '../game/persistence';
import type { SessionSave } from '../game/session';
import {
  rangedCases,
  type RangedPlaytest,
  type RangedSelection,
} from '../game/fixtures/ranged-playtest';
import type { BattleReportDocument } from './battle-report-export';

export const RANGED_RESULTS_KEY = 'ming-defense:dev:ranged8-results:v1';
const TRIAL_VERSION = 'stage8-ranged-minus-one-v1';
const MAX_BYTES = 512 * 1024;
export type RangedResult = RangedSelection & {
  capturedAt: number;
  opening: SessionSave;
  result: 'victory' | 'defeat';
  time: number;
  hp: number;
  damageDone: number;
  damageTaken: number;
  kills: number;
  xpEarned: number;
  boostedMs: number;
  income: number;
  finalBuffs: Progression['buffs'];
};
export type RangedResults = { entries: RangedResult[]; error: string | null };

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
}
function withinBytes(raw: string): boolean {
  return raw.length <= MAX_BYTES && new TextEncoder().encode(raw).length <= MAX_BYTES;
}
function validResult(value: unknown): value is RangedResult {
  if (!object(value)) return false;
  const { caseId, variant, opening, finalBuffs, capturedAt } = value;
  if (caseId !== 'relief' && caseId !== 'setback' && caseId !== 'carryover') return false;
  if (variant !== 'baseline' && variant !== 'candidate') return false;
  if (
    !validSave(opening) ||
    opening.phase !== 'prepare' ||
    opening.preparation.stageId !== 8 ||
    opening.seed !== rangedCases[caseId].seed ||
    opening.mode !== 'campaign'
  )
    return false;
  if (
    !object(finalBuffs) ||
    !Object.entries(finalBuffs).every(
      ([id, level]) =>
        Object.hasOwn(buffDefinitions, id) &&
        Number.isInteger(level) &&
        (level as number) >= 0 &&
        (level as number) <= buffDefinitions[id as keyof typeof buffDefinitions].maxLevel,
    )
  )
    return false;
  return (
    typeof capturedAt === 'number' &&
    Number.isSafeInteger(capturedAt) &&
    capturedAt >= 0 &&
    capturedAt <= 8640000000000000 &&
    (value.result === 'victory' || value.result === 'defeat') &&
    ['time', 'hp', 'damageDone', 'damageTaken', 'kills', 'xpEarned', 'boostedMs', 'income'].every(
      (key) => finite(value[key]),
    ) &&
    (value.boostedMs as number) <= (value.time as number) &&
    (value.result !== 'defeat' || value.income === 0)
  );
}
function clean(result: RangedResult): RangedResult {
  return {
    caseId: result.caseId,
    variant: result.variant,
    capturedAt: result.capturedAt,
    opening: clone(result.opening),
    result: result.result,
    time: result.time,
    hp: result.hp,
    damageDone: result.damageDone,
    damageTaken: result.damageTaken,
    kills: result.kills,
    xpEarned: result.xpEarned,
    boostedMs: result.boostedMs,
    income: result.income,
    finalBuffs: clone(result.finalBuffs),
  };
}

export function rangedResult(trial: RangedPlaytest, now = Date.now()): RangedResult | null {
  const session = trial.session;
  const battle = session.battle;
  const opening = session.battleOpening;
  if (
    !battle ||
    !opening ||
    !battle.report ||
    session.hasChoices ||
    battle.pendingChoices > 0 ||
    battle.result !== session.phase ||
    (session.phase !== 'victory' && session.phase !== 'defeat') ||
    (session.phase === 'victory' && !session.settled)
  )
    return null;
  const result: RangedResult = {
    caseId: trial.caseId,
    variant: trial.variant,
    capturedAt: now,
    opening,
    result: session.phase,
    time: battle.time,
    hp: session.totalHealth(),
    damageDone: battle.damageDone,
    damageTaken: battle.damageTaken,
    kills: battle.kills,
    xpEarned: battle.xpEarned,
    boostedMs: battle.report.boostedMs,
    income:
      session.phase === 'victory' ? session.lastReward + session.lastIncome + session.lastBonus : 0,
    finalBuffs: clone(battle.progression.buffs),
  };
  return validResult(result) ? result : null;
}

export function readRangedResults(storage: StoragePort): RangedResults {
  try {
    const raw = storage.getItem(RANGED_RESULTS_KEY);
    if (raw === null) return { entries: [], error: null };
    if (!withinBytes(raw)) throw Error('size');
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      value.contentVersion !== config.contentVersion ||
      value.trialVersion !== TRIAL_VERSION ||
      !Array.isArray(value.entries) ||
      value.entries.length > 6 ||
      !value.entries.every(validResult)
    )
      throw Error('format');
    const entries = value.entries as RangedResult[];
    if (new Set(entries.map((entry) => `${entry.caseId}:${entry.variant}`)).size !== entries.length)
      throw Error('duplicates');
    return { entries: entries.map(clean), error: null };
  } catch {
    return {
      entries: [],
      error: '试玩记录无法读取（可能为旧版本或损坏），原数据已保留；可清空记录后重试。',
    };
  }
}

export function saveRangedResult(storage: StoragePort, result: RangedResult): RangedResults {
  const current = readRangedResults(storage);
  if (!validResult(result)) return { ...current, error: '本次试玩结果无效，未保存。' };
  const entries = [
    ...current.entries.filter(
      (entry) => entry.caseId !== result.caseId || entry.variant !== result.variant,
    ),
    clean(result),
  ];
  if (current.error)
    return {
      entries,
      error: `${current.error} 本次结果仅在当前页面保留，切换或刷新可能丢失；可先导出。`,
    };
  try {
    const raw = JSON.stringify({
      schemaVersion: 1,
      contentVersion: config.contentVersion,
      trialVersion: TRIAL_VERSION,
      entries,
    });
    if (!withinBytes(raw)) throw Error('size');
    storage.setItem(RANGED_RESULTS_KEY, raw);
    return { entries, error: null };
  } catch {
    return {
      entries,
      error: '试玩结果保存失败，本次结果仅在当前页面保留，切换或刷新可能丢失；可重试或先导出。',
    };
  }
}

export function clearRangedResults(storage: StoragePort): RangedResults {
  try {
    storage.removeItem(RANGED_RESULTS_KEY);
    return { entries: [], error: null };
  } catch {
    return { entries: [], error: '试玩记录清空失败，原数据已保留。' };
  }
}

function buffsSignature(buffs: Progression['buffs']): string {
  return JSON.stringify(
    Object.entries(buffs)
      .filter(([, level]) => level > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function rangedComparison(
  entries: readonly RangedResult[],
  caseId: RangedSelection['caseId'],
) {
  const baseline = entries.find((entry) => entry.caseId === caseId && entry.variant === 'baseline');
  const candidate = entries.find(
    (entry) => entry.caseId === caseId && entry.variant === 'candidate',
  );
  return {
    baseline,
    candidate,
    openingSame:
      baseline && candidate
        ? JSON.stringify(baseline.opening.preparation) ===
          JSON.stringify(candidate.opening.preparation)
        : null,
    talentsSame:
      baseline && candidate
        ? buffsSignature(baseline.finalBuffs) === buffsSignature(candidate.finalBuffs)
        : null,
    boostSame: baseline && candidate ? baseline.boostedMs === candidate.boostedMs : null,
  };
}

export function rangedSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}秒`;
}
export function rangedCapturedAt(at: number): string {
  return new Date(at).toISOString();
}
export const rangedComparisonNote =
  '同开战档、同结束天赋及同聚灵时长不能证明选择时机、顺序和聚灵操作一致；这里只对照事实，不自动判断优劣。';
export function rangedResultsDocument(
  entries: readonly RangedResult[],
  caseId: RangedSelection['caseId'],
): BattleReportDocument {
  const pair = rangedComparison(entries, caseId);
  const lines = [
    '# 灵林守阵 · 第8关试玩战果对照',
    '',
    `- 内容版本：${config.contentVersion}`,
    `- 案例：${caseId} · ${rangedCases[caseId].label}`,
    '- 来源：开发隔离试玩，真实操作的最近完整战果；不是最好成绩或玩家胜率。',
    '',
    '| 项目 | 原方案 | 远程减少 |',
    '| --- | --- | --- |',
  ];
  const rows: [string, (r: RangedResult) => string | number][] = [
    ['结果', (r) => (r.result === 'victory' ? '胜利' : '失败')],
    ['用时（模拟时间）', (r) => rangedSeconds(r.time)],
    ['剩余生命', (r) => Math.floor(r.hp)],
    ['承受伤害', (r) => Math.floor(r.damageTaken)],
    ['造成伤害', (r) => Math.floor(r.damageDone)],
    ['击退', (r) => r.kills],
    ['击杀经验', (r) => r.xpEarned],
    ['聚灵实际生效', (r) => rangedSeconds(r.boostedMs)],
    ['实际入账', (r) => r.income],
    ['捕获时间（UTC）', (r) => rangedCapturedAt(r.capturedAt)],
  ];
  for (const [label, value] of rows)
    lines.push(
      `| ${label} | ${pair.baseline ? value(pair.baseline) : '未试玩'} | ${pair.candidate ? value(pair.candidate) : '未试玩'} |`,
    );
  if (pair.baseline && pair.candidate) {
    lines.push(
      '',
      `- 开战档：${pair.openingSame ? '一致' : '不同'}`,
      `- 结束累计天赋：${pair.talentsSame ? '相同' : '不同'}`,
      `- 聚灵生效时长：${pair.boostSame ? '相同' : '不同'}`,
    );
  } else lines.push('', '两种方案尚未齐全，暂不作双边比较。');
  lines.push(
    '',
    rangedComparisonNote,
    '',
    '候选每波以1只狼替换1只翎羽客，3波基础击杀经验合计少9；正式战役未采用候选。',
  );
  for (const [name, result] of [
    ['原方案', pair.baseline],
    ['远程减少', pair.candidate],
  ] as const) {
    if (!result) continue;
    lines.push(
      '',
      `## ${name} · 开战阵容`,
      '',
      `- 开战灵钱：${result.opening.preparation.currency}`,
      `- 开战等级：${result.opening.preparation.progression.level}`,
      '- 结束累计天赋：',
    );
    for (const [id, level] of Object.entries(result.finalBuffs)
      .filter(([, level]) => level > 0)
      .sort(([a], [b]) => a.localeCompare(b)))
      lines.push(`  - ${buffLabels[id as keyof typeof buffLabels].name}：${level}层`);
    for (const unit of result.opening.preparation.units)
      lines.push(
        `- ${appearances[unit.kind].name}${unit.rank}阶：${unit.position ? `${unit.position.x + 1}列${unit.position.y + 1}行` : '备战席（不参战）'}`,
      );
    lines.push(
      '',
      '### 开战档（用于核对资源、成长、招募和随机流）',
      '',
      '```json',
      JSON.stringify(result.opening, null, 2),
      '```',
    );
  }
  lines.push(
    '',
    '记录只保留在当前标签页的独立开发存储中；刷新/切换保留，通常关闭标签页后清空，浏览器恢复会话可能恢复。此文档不是正式存档，不会上传。',
    '',
  );
  return { fileName: `ming-defense-ranged8-${caseId}-comparison.md`, text: lines.join('\n') };
}
