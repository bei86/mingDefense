import { describe, expect, it } from 'vitest';
import { clone, config } from './content';
import { loadSession, SAVE_KEY, type StoragePort } from './persistence';
import { Session } from './session';
import {
  createBackup,
  inspectBackup,
  MAX_BACKUP_BYTES,
  PREVIOUS_SAVE_KEY,
  readPreviousBackup,
  replaceSavedProgress,
} from './save-transfer';

function deployed(seed = 20261022) {
  const session = new Session(seed);
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  return session;
}
function victorious(stage = 50, pending = false) {
  const session = deployed();
  session.preparation.stageId = stage;
  session.preparation.rewardedStages = Array.from({ length: stage - 1 }, (_, i) => i + 1);
  session.start();
  session.battle!.spawns = [];
  if (pending) {
    const battle = session.battle!;
    battle.progression.xp = 55;
    battle.allies[0].cooldown = 10000;
    battle.enemies = [
      {
        id: 99,
        kind: 'wolf',
        hp: 1,
        maxHp: 220,
        x: 1.5,
        y: 3.5,
        cooldown: 10000,
        recheckAt: 0,
        target: null,
      },
    ];
    battle.attacks = [
      { team: 'ally', source: battle.allies[0].id, target: 99, ordinal: 1, due: 0 },
    ];
  }
  session.tick();
  return session;
}
function storage(failure?: 'read' | 'backup' | 'main') {
  const values = new Map<string, string>();
  const writes: string[] = [];
  const port: StoragePort = {
    getItem(key) {
      if (failure === 'read') throw new Error('blocked');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (
        (failure === 'backup' && key === PREVIOUS_SAVE_KEY) ||
        (failure === 'main' && key === SAVE_KEY)
      )
        throw new Error('quota');
      writes.push(key);
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  return { port, values, writes };
}
function preview(text: string) {
  const inspected = inspectBackup(text);
  if (!inspected.ok) throw new Error(inspected.error);
  return inspected.preview;
}

describe('存档备份和替换事务', () => {
  it('整备原样往返，封装可识别，预览不改变会话或随机状态', () => {
    const session = deployed();
    const before = session.exportSave();
    const text = createBackup(session, new Date('2026-10-22T08:00:00Z'));
    expect(JSON.parse(text)).toMatchObject({
      format: 'ming-defense-backup',
      backupVersion: 1,
      exportedAt: '2026-10-22T08:00:00.000Z',
    });
    expect(preview(text)).toMatchObject({
      save: before,
      stage: 1,
      level: 1,
      currency: 45,
      units: 1,
      migrated: false,
    });
    expect(preview(JSON.stringify(before)).save).toEqual(before);
    expect(preview('\uFEFF' + text).save).toEqual(before);
    expect(session.exportSave()).toEqual(before);
  });
  it.each(['combat', 'defeat'] as const)('%s导出回到开战检查点，不带入临时收入与天赋', (phase) => {
    const session = deployed();
    const before = clone(session.preparation);
    session.start();
    session.battle!.income = 999;
    session.battle!.progression.buffs.attack = 3;
    if (phase === 'defeat') {
      session.battle!.allies[0].hp = 0;
      session.tick();
    }
    const backup = preview(createBackup(session));
    expect(backup.state).toBe('开战前检查点');
    expect(backup.save.phase).toBe('prepare');
    expect(backup.save.battle).toBeNull();
    expect(backup.save.preparation).toEqual(before);
    expect(session.phase).toBe(phase);
  });
  it('50完成态恢复和重载不重领奖，不提供51关', () => {
    const completed = victorious();
    const candidate = preview(createBackup(completed));
    expect(candidate.state).toBe('五十关已完成');
    const { port } = storage();
    const result = replaceSavedProgress(port, deployed(2), candidate.save);
    expect(result.ok).toBe(true);
    const loaded = loadSession(port).session;
    expect(loaded.complete).toBe(true);
    expect(loaded.nextStage()).toBeTruthy();
    loaded.tick();
    expect(loaded.preparation).toEqual(completed.preparation);
  });
  it('关后待选保留选择，导入后选完才结算且只结算一次', () => {
    const pending = victorious(1, true);
    const backup = preview(createBackup(pending));
    expect(backup.state).toBe('关后待选天赋');
    expect(backup.level).toBe(pending.battle!.progression.level);
    const loaded = Session.restore(backup.save);
    expect(loaded.hasChoices).toBe(true);
    expect(loaded.nextStage()).toBeTruthy();
    expect(loaded.chooseBuff(loaded.battle!.choices[0])).toBeNull();
    const after = clone(loaded.preparation);
    expect(after.currency).toBeGreaterThan(backup.currency);
    const reloaded = Session.restore(preview(createBackup(loaded)).save);
    reloaded.tick();
    expect(reloaded.preparation).toEqual(after);
  });
  it('已知v23旧45档只升级版本，继续46不重复奖励', () => {
    const old = victorious(45).exportSave();
    old.contentVersion = 'prototype-2026-10-22-v23';
    const before = clone(old);
    const imported = preview(JSON.stringify(old));
    expect(imported.migrated).toBe(true);
    expect(imported.save.contentVersion).toBe(config.contentVersion);
    expect(old).toEqual(before);
    const loaded = Session.restore(imported.save);
    expect(loaded.nextStage()).toBeNull();
    expect(loaded.preparation.stageId).toBe(46);
    expect(loaded.preparation.currency).toBe(old.preparation.currency);
  });
  it.each([
    '',
    '{',
    'null',
    '[]',
    '{"format":"other","backupVersion":1}',
    '{"format":"ming-defense-backup","backupVersion":2}',
  ])('损坏或外来输入拒绝：%s', (text) => {
    expect(inspectBackup(text).ok).toBe(false);
  });
  it('拒绝超限、未知版本、越界、重叠和非法数值', () => {
    expect(inspectBackup('桃'.repeat(Math.ceil(MAX_BACKUP_BYTES / 3))).ok).toBe(false);
    const base = deployed().exportSave();
    const invalid = [
      { ...base, contentVersion: 'future' },
      { ...base, schemaVersion: 999 },
      { ...base, preparation: { ...base.preparation, currency: -1 } },
      { ...base, preparation: { ...base.preparation, stageId: 51 } },
    ];
    const overlap = clone(base);
    overlap.preparation.units.push({ ...clone(overlap.preparation.units[0]), id: 50 });
    overlap.preparation.nextId = 51;
    invalid.push(overlap);
    for (const value of invalid) expect(inspectBackup(JSON.stringify(value)).ok).toBe(false);
  });
  it('确认后先备份当前会话及主档再替换，读取备份可恢复，原会话不变', () => {
    const current = deployed(1),
      incoming = deployed(2);
    const before = current.exportSave();
    const { port, values, writes } = storage();
    values.set(SAVE_KEY, 'original raw file');
    const candidate = preview(createBackup(incoming));
    expect(writes).toEqual([]);
    expect(replaceSavedProgress(port, current, candidate.save).ok).toBe(true);
    expect(writes).toEqual([PREVIOUS_SAVE_KEY, SAVE_KEY]);
    expect(current.exportSave()).toEqual(before);
    expect(JSON.parse(values.get(PREVIOUS_SAVE_KEY)!)).toMatchObject({
      replacedRaw: 'original raw file',
    });
    const previous = readPreviousBackup(port);
    expect(previous.ok).toBe(true);
    if (!previous.ok) throw new Error(previous.error);
    expect(previous.preview.save).toEqual(before);
    expect(replaceSavedProgress(port, incoming, previous.preview.save).ok).toBe(true);
    expect(loadSession(port).session.preparation).toEqual(current.preparation);
  });
  it.each(['read', 'backup', 'main'] as const)(
    '%s失败保留原主档和当前会话，不返回新会话',
    (failure) => {
      const current = deployed(1);
      const before = current.exportSave();
      const { port, values, writes } = storage(failure);
      values.set(SAVE_KEY, 'original');
      expect(replaceSavedProgress(port, current, deployed(2).exportSave()).ok).toBe(false);
      expect(values.get(SAVE_KEY)).toBe('original');
      expect(current.exportSave()).toEqual(before);
      expect(writes).not.toContain(SAVE_KEY);
    },
  );
  it('事务重新验证候选，非法数据不能触发读写', () => {
    const { port, writes } = storage('read');
    const bad = deployed().exportSave();
    bad.preparation.currency = -1;
    expect(replaceSavedProgress(port, deployed(), bad)).toMatchObject({
      ok: false,
      error: '待导入存档无效，请重新校验。',
    });
    expect(writes).toEqual([]);
  });
  it('替换前备份不存在、读取失败或损坏时不改主档', () => {
    const { port, values, writes } = storage();
    expect(readPreviousBackup(port).ok).toBe(false);
    values.set(PREVIOUS_SAVE_KEY, 'bad');
    expect(readPreviousBackup(port).ok).toBe(false);
    values.set(PREVIOUS_SAVE_KEY, 'null');
    expect(readPreviousBackup(port).ok).toBe(false);
    expect(readPreviousBackup(storage('read').port).ok).toBe(false);
    expect(writes).toEqual([]);
  });
});
