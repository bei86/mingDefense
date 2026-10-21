import { describe, expect, it } from 'vitest';
import { clone, config } from './content';
import { loadSession, saveSession, SAVE_KEY, validSave, type StoragePort } from './persistence';
import { Session } from './session';
import { buffDefinitions } from './progression';
import type { BuffId } from './model';

class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
}
function deployed() {
  const s = new Session();
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id });
  s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
  s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  return s;
}
function finish(s: Session) {
  for (let i = 0; i < 5000; i++) {
    if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
    else if (s.phase === 'combat') s.tick();
    else return;
  }
  throw new Error('未完成');
}
describe('本地检查点存档', () => {
  it('准备状态完整往返，不保存可撤销临时对象', () => {
    const s = deployed();
    const storage = new MemoryStorage();
    expect(saveSession(storage, s)).toBeNull();
    expect(validSave(JSON.parse(storage.getItem(SAVE_KEY)!))).toBe(true);
    const loaded = loadSession(storage);
    expect(loaded.recovered).toBe(true);
    expect(loaded.session.preparation).toEqual(s.preparation);
    expect(loaded.session.canUndo).toBe(false);
  });
  it('战斗中保存只保存开战检查点，已选天赋/产钱不带回', () => {
    const s = deployed();
    const before = clone(s.preparation);
    s.start();
    while (!s.hasChoices) s.tick();
    s.chooseBuff(s.battle!.choices[0]);
    s.battle!.income = 999;
    const storage = new MemoryStorage();
    saveSession(storage, s);
    const loaded = loadSession(storage);
    expect(loaded.session.phase).toBe('prepare');
    expect(loaded.session.battle).toBeNull();
    expect(loaded.session.preparation).toEqual(before);
    expect(loaded.message).toContain('检查点');
  });
  it('关后已结算恢复不重复奖励，推进后存档保持阶段与成长', () => {
    const s = deployed();
    s.start();
    finish(s);
    const money = s.preparation.currency;
    const storage = new MemoryStorage();
    saveSession(storage, s);
    const loaded = loadSession(storage).session;
    expect(loaded.phase).toBe('victory');
    expect(loaded.settled).toBe(true);
    expect(loaded.preparation.currency).toBe(money);
    expect(loaded.nextStage()).toBeNull();
    saveSession(storage, loaded);
    const next = loadSession(storage).session;
    expect(next.preparation.stageId).toBe(2);
    expect(next.preparation.progression).toEqual(s.preparation.progression);
    expect(next.preparation.currency).toBe(money);
  });
  it('最后一击升级先判胜，关后待选可恢复且只结算一次', () => {
    const s = deployed();
    s.start();
    const battle = s.battle!;
    battle.spawns = [];
    battle.spawnIndex = 0;
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
    battle.allies.forEach((u) => (u.cooldown = 10000));
    battle.progression.xp = 55;
    battle.attacks = [
      { team: 'ally', source: battle.allies[0].id, target: 99, ordinal: 1, due: 0 },
    ];
    s.tick();
    expect(s.phase).toBe('victory');
    expect(s.hasChoices).toBe(true);
    expect(s.settled).toBe(false);
    expect(s.preparation.currency).toBe(45);
    const storage = new MemoryStorage();
    saveSession(storage, s);
    const loaded = loadSession(storage).session;
    expect(loaded.hasChoices).toBe(true);
    expect(loaded.nextStage()).toBeTruthy();
    loaded.chooseBuff(loaded.battle!.choices[0]);
    expect(loaded.settled).toBe(true);
    expect(loaded.preparation.currency).toBeGreaterThanOrEqual(70);
    const after = loaded.preparation.currency;
    saveSession(storage, loaded);
    expect(loadSession(storage).session.preparation.currency).toBe(after);
  });
  it('未知版本/损坏JSON/越界位置/重叠/非法阶级/天赋上限备份保留', () => {
    const original = deployed().exportSave();
    const cases: unknown[] = [
      { ...original, contentVersion: 'v-old' },
      'invalid-json',
      { ...original, preparation: { ...original.preparation, stageId: 99 } },
    ];
    const overlap = clone(original);
    overlap.preparation.units[1].position = clone(overlap.preparation.units[0].position);
    cases.push(overlap);
    const rank = clone(original);
    rank.preparation.units[0].rank = 7;
    cases.push(rank);
    const buffs = clone(original);
    buffs.preparation.progression.buffs.attack = 999;
    cases.push(buffs);
    for (const value of cases) {
      const storage = new MemoryStorage();
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      storage.setItem(SAVE_KEY, raw);
      const loaded = loadSession(storage);
      expect(loaded.recovered).toBe(false);
      expect(loaded.message).toContain('备份');
      expect(storage.getItem(SAVE_KEY)).toBeNull();
      expect([...storage.values.values()]).toContain(raw);
    }
  });
  it('写入/读取/备份失败不覆盖原档、不阻塞本轮', () => {
    const s = deployed();
    const unavailable: StoragePort = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('quota');
      },
      removeItem() {
        throw new Error('denied');
      },
    };
    expect(saveSession(unavailable, s)).toContain('失败');
    expect(loadSession(unavailable).blocked).toBe(true);
    const original = '{broken';
    const blocked: StoragePort = {
      getItem() {
        return original;
      },
      setItem() {
        throw new Error('quota');
      },
      removeItem() {
        throw new Error('must not delete');
      },
    };
    expect(loadSession(blocked)).toMatchObject({ blocked: true, recovered: false });
    expect(blocked.getItem(SAVE_KEY)).toBe(original);
  });
  it('胜利档排除渲染尾迹，拒绝重复单位、残留攻击和无效结算数值', () => {
    const s = deployed();
    s.start();
    finish(s);
    const original = s.exportSave();
    expect(original.battle!.flashes).toEqual([]);
    expect(original.battle!.spawns).toEqual([]);
    expect(validSave(original)).toBe(true);
    const duplicate = clone(original);
    duplicate.battle!.allies[1] = clone(duplicate.battle!.allies[0]);
    expect(validSave(duplicate)).toBe(false);
    const trail = clone(original);
    trail.battle!.flashes = [null as never];
    expect(validSave(trail)).toBe(false);
    const invalid = clone(original);
    invalid.battle!.damageDone = NaN;
    expect(validSave(invalid)).toBe(false);
    const shield = clone(original);
    shield.battle!.allies[0].shield = -1;
    expect(validSave(shield)).toBe(false);
    const noSurvivors = clone(original);
    noSurvivors.battle!.allies.forEach((u) => (u.hp = 0));
    expect(validSave(noSurvivors)).toBe(false);
  });
  it('天赋池耗尽换钱随胜利结算，退出/失败全部回滚', () => {
    const s = deployed();
    for (const id of Object.keys(buffDefinitions) as BuffId[])
      s.preparation.progression.buffs[id] = buffDefinitions[id].maxLevel;
    const before = clone(s.preparation);
    s.start();
    finish(s);
    expect(s.preparation.currency).toBeGreaterThan(70);
    expect(config.contentVersion).toContain('v15');
    const aborted = Session.restore({
      ...s.exportSave(),
      phase: 'prepare',
      battle: null,
      preparation: before,
    });
    aborted.start();
    aborted.battle!.income = 999;
    aborted.battle!.fallbackIncome = 5;
    aborted.backToPreparation();
    expect(aborted.preparation).toEqual(before);
  });
});

describe('战报存档与v2迁移', () => {
  it('新战报往返一致，拒绝缺行、重复实例、无效数值、总数不一致及超长聚灵', () => {
    const s = deployed();
    s.start();
    finish(s);
    const original = s.exportSave();
    expect(validSave(original)).toBe(true);
    expect(Session.restore(original).battle!.report).toEqual(s.battle!.report);
    const cases = Array.from({ length: 6 }, () => clone(original));
    cases[0].battle!.report!.units.pop();
    cases[1].battle!.report!.units[1].id = cases[1].battle!.report!.units[0].id;
    cases[2].battle!.report!.units[0].income = -1;
    cases[3].battle!.report!.units[0].damageDone++;
    cases[4].battle!.report!.boostedMs = original.battle!.time + 1;
    cases[5].battle!.report!.units[0].shieldGiven = NaN;
    for (const save of cases) expect(validSave(save)).toBe(false);
  });
  it.each([
    'prototype-2026-10-15-v2',
    'prototype-2026-10-16-v3',
    'prototype-2026-10-16-v4',
    'prototype-2026-10-16-v5',
    'prototype-2026-10-16-v6',
    'prototype-2026-10-16-v7',
    'prototype-2026-10-16-v8',
    'prototype-2026-10-16-v9',
    'prototype-2026-10-18-v10',
    'prototype-2026-10-18-v11',
    'prototype-2026-10-18-v12',
  ])('%s整备和旧胜利档迁移前备份，保留阵容成长及已结算奖励，不伪造战报', (version) => {
    const s = deployed();
    const prepare = s.exportSave();
    s.start();
    finish(s);
    const victory = s.exportSave();
    if (version === 'prototype-2026-10-15-v2') delete victory.battle!.report;
    for (const save of [prepare, victory]) {
      save.contentVersion = version;
      const raw = JSON.stringify(save);
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, raw);
      const result = loadSession(storage);
      expect(result).toMatchObject({ recovered: true, blocked: false });
      expect(result.message).toContain('新版平衡');
      expect(result.session.preparation).toEqual(save.preparation);
      expect(result.session.phase).toBe(save.phase);
      expect(
        [...storage.values.entries()].some(
          ([k, v]) => k.startsWith(SAVE_KEY + ':backup:') && v === raw,
        ),
      ).toBe(true);
      expect(JSON.parse(storage.getItem(SAVE_KEY)!).contentVersion).toBe(config.contentVersion);
      expect(result.session.battle?.report).toEqual(save.battle?.report);
      if (save.phase === 'victory') {
        expect(result.session.nextStage()).toBeNull();
        expect(result.session.preparation.currency).toBe(save.preparation.currency);
      }
    }
  });
  it('迁移备份或主档写入失败时保留原始主档，并停止自动覆盖', () => {
    const save = deployed().exportSave();
    save.contentVersion = 'prototype-2026-10-16-v8';
    const raw = JSON.stringify(save);
    for (const failAt of [1, 2]) {
      const memory = new MemoryStorage();
      memory.setItem(SAVE_KEY, raw);
      let writes = 0;
      const storage: StoragePort = {
        getItem: (k) => memory.getItem(k),
        setItem(k, v) {
          if (++writes === failAt) throw new Error('quota');
          memory.setItem(k, v);
        },
        removeItem() {
          throw new Error('must not delete');
        },
      };
      const result = loadSession(storage);
      expect(result).toMatchObject({ recovered: true, blocked: true });
      expect(result.session.preparation).toEqual(save.preparation);
      expect(memory.getItem(SAVE_KEY)).toBe(raw);
    }
  });
});
