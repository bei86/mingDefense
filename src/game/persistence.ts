import { cells, config, heroIds, key, stages } from './content';
import { buffDefinitions, eligibleBuffs, threshold } from './progression';
import { Session, type Preparation, type SessionSave } from './session';
import type { BuffId, Progression } from './model';

export const SAVE_KEY = 'ming-defense:campaign';
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type LoadResult = {
  session: Session;
  message: string;
  recovered: boolean;
  blocked: boolean;
};
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min = 0, max = 1e9): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function validProgression(v: unknown): v is Progression {
  if (
    !record(v) ||
    !integer(v.level, 1, 10000) ||
    !integer(v.xp) ||
    v.xp >= threshold(v.level) ||
    !integer(v.rng, 1, 0xffffffff) ||
    !record(v.buffs)
  )
    return false;
  return Object.entries(v.buffs).every(
    ([id, level]) =>
      id in buffDefinitions && integer(level, 0, buffDefinitions[id as BuffId].maxLevel),
  );
}
function validPreparation(v: unknown, mode: string): v is Preparation {
  if (
    !record(v) ||
    !integer(v.currency) ||
    !integer(v.stageId, 1, mode === 'm1' ? 1 : stages.length) ||
    !integer(v.rng, 1, 0xffffffff) ||
    !integer(v.combatRng, 1, 0xffffffff) ||
    !integer(v.nextId, 1) ||
    !validProgression(v.progression)
  )
    return false;
  if (
    !Array.isArray(v.unlocked) ||
    !v.unlocked.length ||
    v.unlocked.length > 36 ||
    new Set(v.unlocked).size !== v.unlocked.length ||
    !v.unlocked.every((c) => typeof c === 'string' && /^[0-5],[0-5]$/.test(c))
  )
    return false;
  if (
    !Array.isArray(v.units) ||
    v.units.length > 38 ||
    !Array.isArray(v.offers) ||
    ![3, 4].includes(v.offers.length)
  )
    return false;
  const pool = mode === 'm1' ? config.scope.M1.unitIds : heroIds;
  const ids: number[] = [];
  const occupied = new Set<string>();
  let reserve = 0;
  for (const u of v.units) {
    if (
      !record(u) ||
      !integer(u.id, 1) ||
      !pool.includes(u.kind as never) ||
      !integer(u.rank, 1, mode === 'm1' ? 3 : 6)
    )
      return false;
    ids.push(u.id);
    if (u.position === null) reserve++;
    else {
      if (!record(u.position) || !integer(u.position.x, 0, 5) || !integer(u.position.y, 0, 5))
        return false;
      for (const c of cells(u.kind as (typeof heroIds)[number], {
        x: u.position.x,
        y: u.position.y,
      })) {
        const cell = key(c);
        if (!v.unlocked.includes(cell) || occupied.has(cell)) return false;
        occupied.add(cell);
      }
    }
  }
  if (reserve > config.board.reserveUnitLimit || new Set(ids).size !== ids.length) return false;
  const offerIds: number[] = [];
  for (const o of v.offers) {
    if (
      !record(o) ||
      !integer(o.id, 1) ||
      typeof o.claimed !== 'boolean' ||
      !(o.kind === 'cell' || pool.includes(o.kind as never))
    )
      return false;
    offerIds.push(o.id);
  }
  if (new Set(offerIds).size !== offerIds.length || Math.max(0, ...ids, ...offerIds) >= v.nextId)
    return false;
  if (
    !Array.isArray(v.rewardedStages) ||
    new Set(v.rewardedStages).size !== v.rewardedStages.length ||
    !v.rewardedStages.every((n) => integer(n, 1, v.stageId as number))
  )
    return false;
  for (let i = 1; i < v.stageId; i++) if (!v.rewardedStages.includes(i)) return false;
  return true;
}
export function validSave(v: unknown): v is SessionSave {
  if (
    !record(v) ||
    v.schemaVersion !== 2 ||
    v.contentVersion !== config.contentVersion ||
    !['m1', 'campaign'].includes(v.mode as string) ||
    !integer(v.seed, 0, 0xffffffff) ||
    !validPreparation(v.preparation, v.mode as string) ||
    !['prepare', 'victory'].includes(v.phase as string)
  )
    return false;
  if (
    ![v.lastReward, v.lastIncome, v.lastBonus].every((n) => integer(n)) ||
    ![1, 2].includes(v.speed as number) ||
    typeof v.settled !== 'boolean' ||
    typeof v.recoveredBattle !== 'boolean'
  )
    return false;
  if (v.phase === 'prepare') return v.battle === null;
  const preparation = v.preparation;
  const b = v.battle;
  if (
    !record(b) ||
    b.result !== 'victory' ||
    b.stageId !== v.preparation.stageId ||
    !finite(b.time) ||
    b.time < 0 ||
    b.time > config.runtime.stageLimitMs ||
    !validProgression(b.progression)
  )
    return false;
  if (
    !Array.isArray(b.allies) ||
    !b.allies.some((u) => record(u) && finite(u.hp) && u.hp > 0) ||
    b.allies.length !== preparation.units.filter((u) => u.position).length ||
    new Set(b.allies.map((u) => (record(u) ? u.id : null))).size !== b.allies.length ||
    !b.allies.every(
      (u) =>
        record(u) &&
        preparation.units.some(
          (p) =>
            p.position &&
            p.id === u.id &&
            p.kind === u.kind &&
            p.rank === u.rank &&
            JSON.stringify(p.position) === JSON.stringify(u.position),
        ) &&
        finite(u.hp) &&
        u.hp >= 0 &&
        finite(u.maxHp) &&
        u.maxHp > 0 &&
        u.hp <= u.maxHp &&
        integer(u.ordinal) &&
        finite(u.cooldown) &&
        integer(u.shield) &&
        finite(u.shieldExpires) &&
        finite(u.incomeAt),
    )
  )
    return false;
  if (
    !integer(b.rng, 1, 0xffffffff) ||
    !integer(b.pendingChoices, 0, 10000) ||
    !Array.isArray(b.choices) ||
    b.choices.length > 3 ||
    new Set(b.choices).size !== b.choices.length ||
    !integer(b.income) ||
    !integer(b.fallbackIncome) ||
    !integer(b.kills) ||
    !integer(b.xpEarned)
  )
    return false;
  const allowed = eligibleBuffs(b.progression, v.preparation.units, v.preparation.stageId);
  if (
    !b.choices.every((id) => allowed.includes(id as BuffId)) ||
    b.choices.length > 0 !== b.pendingChoices > 0
  )
    return false;
  for (const field of ['enemies', 'attacks', 'released', 'fields', 'warnings', 'spawns', 'flashes'])
    if (!Array.isArray(b[field]) || b[field].length !== 0) return false;
  if (
    b.spawnIndex !== 0 ||
    !integer(b.nextFieldId, 1) ||
    !integer(b.nextEnemyId, 1) ||
    !finite(b.energy) ||
    b.energy < 0 ||
    b.energy > config.energy.capacity ||
    b.boosted !== false ||
    typeof b.progressionEnabled !== 'boolean' ||
    !finite(b.damageDone) ||
    b.damageDone < 0 ||
    !finite(b.damageTaken) ||
    b.damageTaken < 0
  )
    return false;
  if (b.report !== undefined) {
    const report = b.report;
    const allies = b.allies;
    if (
      !record(report) ||
      !integer(report.boostedMs, 0, b.time) ||
      !Array.isArray(report.units) ||
      report.units.length !== b.allies.length ||
      new Set(report.units.map((u) => (record(u) ? u.id : null))).size !== report.units.length ||
      !report.units.every(
        (u) =>
          record(u) &&
          allies.some((ally) => record(ally) && ally.id === u.id) &&
          ['damageDone', 'damageTaken', 'income', 'shieldGiven', 'shieldAbsorbed'].every((k) =>
            integer(u[k]),
          ),
      )
    )
      return false;
    for (const [field, total] of [
      ['damageDone', b.damageDone],
      ['damageTaken', b.damageTaken],
      ['income', b.income],
    ] as const) {
      if (report.units.reduce((n, u) => n + Number((u as RecordValue)[field]), 0) !== total)
        return false;
    }
  }
  if (v.settled !== (b.pendingChoices === 0)) return false;
  if (v.settled !== v.preparation.rewardedStages.includes(v.preparation.stageId)) return false;
  return true;
}
export function loadSession(storage: StoragePort, seed = 20261014): LoadResult {
  const fresh = () => new Session(seed);
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return {
      session: fresh(),
      message: '无法读取本地存档，本轮仍可游玩。',
      recovered: false,
      blocked: true,
    };
  }
  if (!raw) return { session: fresh(), message: '', recovered: false, blocked: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  let migrated = false;
  if (
    record(parsed) &&
    [
      'prototype-2026-10-15-v2',
      'prototype-2026-10-16-v3',
      'prototype-2026-10-16-v4',
      'prototype-2026-10-16-v5',
    ].includes(parsed.contentVersion as string)
  ) {
    const candidate = { ...parsed, contentVersion: config.contentVersion };
    if (validSave(candidate)) {
      try {
        storage.setItem(`${SAVE_KEY}:backup:${Date.now()}`, raw);
        storage.setItem(SAVE_KEY, JSON.stringify(candidate));
      } catch {
        return {
          session: Session.restore(candidate),
          message: '已读取旧进度，但版本升级写入失败，原档及可用备份保留，本轮不自动覆盖。',
          recovered: true,
          blocked: true,
        };
      }
      parsed = candidate;
      migrated = true;
    }
  }
  if (!validSave(parsed)) {
    const reason =
      record(parsed) && parsed.contentVersion !== config.contentVersion
        ? '存档内容版本不兼容'
        : '存档数据损坏';
    try {
      const backupKey = `${SAVE_KEY}:backup:${Date.now()}`;
      storage.setItem(backupKey, raw);
      storage.removeItem(SAVE_KEY);
      return {
        session: fresh(),
        message: `${reason}，旧档已备份，已开始新一轮。`,
        recovered: false,
        blocked: false,
      };
    } catch {
      return {
        session: fresh(),
        message: `${reason}且无法备份，原档已保留，本轮不自动覆盖。`,
        recovered: false,
        blocked: true,
      };
    }
  }
  return {
    session: Session.restore(parsed),
    message:
      (parsed.recoveredBattle ? '已恢复开战前检查点，本次战斗收益未保留。' : '已恢复本地进度。') +
      (migrated ? '旧档已备份，阵容与成长保留，后续战斗采用新版平衡。' : ''),
    recovered: true,
    blocked: false,
  };
}
export function saveSession(storage: StoragePort, session: Session): string | null {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(session.exportSave()));
    return null;
  } catch {
    return '本地存档写入失败，本轮可继续游玩，但刷新可能丢失进度。';
  }
}
