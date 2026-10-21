import { describe, expect, it } from 'vitest';
import { clone, config, stages, enemyDefinitions } from './content';
import { waveSpawns } from './combat';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import oldCheckpoint from './fixtures/boss-checkpoint.json';
import sixthCheckpoint from './fixtures/stage-6-checkpoint.json';
import tenthCheckpoint from './fixtures/stage-10-checkpoint.json';
import eighthCheckpoint from './fixtures/stage-8-checkpoint.json';
import previousConfig from '../../docs/superpowers/specs/2026-10-16-prototype-balance-v7-snapshot.json';

function sixth(seed = 20261016) {
  const s = new Session(seed);
  s.preparation.stageId = 6;
  s.preparation.rewardedStages = [1, 2, 3, 4, 5];
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}

describe('十关循环', () => {
  it('保留前五关与八灵参数；新关敌人和首领引用完整，开发检查点有效', () => {
    expect(config.stages.slice(0, 5)).toEqual(previousConfig.stages);
    expect(config.units).toEqual(previousConfig.units);
    expect(config.boss).toEqual(previousConfig.boss);
    expect(stages.slice(0, 10).map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const stage of stages) {
      if (stage.bossId)
        expect([
          config.boss.id,
          config.secondBoss.id,
          config.thirdBoss.id,
          config.fourthBoss.id,
          config.fifthBoss.id,
          config.sixthBoss.id,
          config.seventhBoss.id,
          config.eighthBoss.id,
        ]).toContain(stage.bossId);
      for (const wave of stage.waves)
        for (const [kind, count] of Object.entries(wave.enemies)) {
          expect(enemyDefinitions[kind]).toBeDefined();
          expect(Number.isInteger(count) && count! > 0).toBe(true);
        }
    }
    for (const checkpoint of [oldCheckpoint, sixthCheckpoint, eighthCheckpoint, tenthCheckpoint])
      expect(validSave(checkpoint)).toBe(true);
  });
  it('前十关每秒一只连续出怪；前十关只有5/10关有首领', () => {
    expect(stages.slice(0, 10)).toHaveLength(10);
    expect(
      stages
        .slice(0, 10)
        .filter((s) => s.bossId)
        .map((s) => s.id),
    ).toEqual([5, 10]);
    for (let id = 6; id <= 10; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('二阶自然招募只在六关起出现；高阶卡部署与合成以实际阶级判断', () => {
    const seen = new Set<number>();
    let higher: Session | undefined;
    for (let seed = 1; seed <= 100; seed++) {
      const s = sixth(seed);
      expect(s.refresh(true)).toBeNull();
      for (const o of s.preparation.offers) seen.add(o.rank ?? 1);
      if (s.preparation.offers.some((o) => o.rank === 2)) higher = s;
      const early = new Session(seed);
      early.refresh(true);
      expect(early.preparation.offers.every((o) => (o.rank ?? 1) === 1)).toBe(true);
    }
    expect([...seen].sort()).toEqual([1, 2]);
    const s = higher!;
    const offer = s.preparation.offers.find((o) => o.rank === 2)!;
    expect(s.transfer({ type: 'offer', id: offer.id }, { x: 0, y: 0 })).toBeNull();
    const target = s.preparation.units[0];
    expect(target.rank).toBe(2);
    const id = s.preparation.nextId++;
    s.preparation.offers[1] = { id, kind: target.kind, rank: 2, claimed: false };
    expect(s.transfer({ type: 'offer', id }, { merge: target.id })).toBeNull();
    expect(s.preparation.units[0].rank).toBe(3);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it('旧无rank卡仍为一阶，非法阶级被拒绝', () => {
    const s = sixth();
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 0, y: 0 })).toBeNull();
    expect(s.preparation.units[0].rank).toBe(1);
    const save = s.exportSave();
    expect(validSave(save)).toBe(true);
    for (const rank of [0, 3, 7, 1.5]) {
      const invalid = clone(save);
      invalid.preparation.offers[1].rank = rank;
      expect(validSave(invalid)).toBe(false);
    }
  });
  it('二阶招募不能与一阶合成，失败时不消耗卡牌或改变随机数', () => {
    const s = sixth();
    s.transfer({ type: 'offer', id: 1 }, { x: 0, y: 0 });
    s.preparation.offers[1].rank = 2;
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id })).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
  it('v7第五关胜利档迁移后继续第六关，奖励不重复、招募刷新一次', () => {
    const s = Session.restore({
      ...oldCheckpoint,
      contentVersion: config.contentVersion,
    } as ReturnType<Session['exportSave']>);
    expect(s.start()).toBeNull();
    s.battle!.spawns = [];
    for (let i = 0; i < 20 && s.phase === 'combat'; i++) s.tick();
    expect(s.phase).toBe('victory');
    const save = s.exportSave();
    save.contentVersion = 'prototype-2026-10-16-v7';
    const raw = JSON.stringify(save);
    const storage = new Map<string, string>([[SAVE_KEY, raw]]);
    const loaded = loadSession({
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => {
        storage.set(k, v);
      },
      removeItem: (k) => {
        storage.delete(k);
      },
    });
    expect(loaded.recovered).toBe(true);
    expect([...storage.values()]).toContain(raw);
    expect(loaded.session.complete).toBe(false);
    const money = loaded.session.preparation.currency;
    const rng = loaded.session.preparation.rng;
    expect(loaded.session.nextStage()).toBeNull();
    expect(loaded.session.preparation.stageId).toBe(6);
    expect(loaded.session.preparation.currency).toBe(money);
    expect(loaded.session.preparation.rng).not.toBe(rng);
    expect(loaded.session.nextStage()).toBeTruthy();
    expect(validSave(loaded.session.exportSave())).toBe(true);
  });
  it('第十关后可继续十一关，失败和中止回滚二阶卡及成长', () => {
    const s = sixth();
    s.preparation.units = [{ id: 5, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 4 } }];
    s.preparation.nextId = 6;
    s.preparation.offers[0].rank = 2;
    const before = clone(s.preparation);
    s.start();
    s.battle!.income = 1000;
    s.battle!.progression.buffs.attack = 10;
    s.backToPreparation();
    expect(s.preparation).toEqual(before);
    s.start();
    s.battle!.progression.buffs.health = 5;
    s.battle!.allies[0].hp = 0;
    s.tick();
    expect(s.phase).toBe('defeat');
    expect(s.retry()).toBeNull();
    expect(s.preparation).toEqual(before);
    s.backToPreparation();
    s.preparation.stageId = 10;
    s.preparation.rewardedStages = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const tenth = clone(s.preparation);
    s.start();
    s.battle!.income = 999;
    s.battle!.allies.forEach((u) => (u.hp = 0));
    s.tick();
    expect(s.phase).toBe('defeat');
    expect(s.retry()).toBeNull();
    expect(s.preparation).toEqual(tenth);
    expect(s.battle!.income).toBe(0);
    s.backToPreparation();
    s.start();
    s.battle!.spawns = [];
    s.tick();
    expect(s.complete).toBe(false);
    expect(s.nextStage()).toBeNull();
    expect(s.preparation.stageId).toBe(11);
    expect(validSave(s.exportSave())).toBe(true);
  });
});
