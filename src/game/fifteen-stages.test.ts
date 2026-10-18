import { describe, expect, it } from 'vitest';
import { bossDefinition, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import v9 from '../../docs/superpowers/specs/2026-10-18-prototype-balance-v9-snapshot.json';

function arena(stageId = 15) {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ice_fish', rank: 6, position: { x: 2, y: 1 } },
      { id: 3, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 4 } },
    ],
    { stageId },
  );
  s.spawns = [{ at: 179000, x: 0 }];
  s.allies.forEach((u) => {
    u.cooldown = 200000;
  });
  const boss = spawnEnemy(s, 'boss', { x: 3.5, y: 0 });
  boss.cooldown = 200000;
  return { s, boss };
}
function won(stageId: number) {
  const s = new Session(20261018);
  s.preparation.stageId = stageId;
  s.preparation.rewardedStages = Array.from({ length: stageId - 1 }, (_, i) => i + 1);
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  s.start();
  s.battle!.spawns = [];
  s.tick();
  expect(s.phase).toBe('victory');
  return s;
}

describe('十五关与岩铠领主', () => {
  it('仅追加后五关和第三首领，原有内容完全保留', () => {
    const { thirdBoss: _boss, fourthBoss: _fourth, ...old } = config;
    expect({
      ...old,
      contentVersion: v9.contentVersion,
      status: v9.status,
      stages: old.stages.slice(0, 10),
      scope: v9.scope,
    }).toEqual(v9);
    expect(stages.slice(0, 15).map((s) => s.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
    expect(config.scope.M2M3.stageIds).toEqual(stages.map((s) => s.id));
    expect(
      stages
        .slice(0, 15)
        .filter((s) => s.bossId)
        .map((s) => s.id),
    ).toEqual([5, 10, 15]);
    expect(bossDefinition(5)).toBe(config.boss);
    expect(bossDefinition(10)).toBe(config.secondBoss);
    expect(bossDefinition(15)).toBe(config.thirdBoss);
    expect(bossDefinition(11)).toBe(config.boss);
    expect(bossName(15)).toBe('岩铠领主');
    const id = stages[14].bossId;
    try {
      stages[14].bossId = 'missing';
      expect(() => bossDefinition(15)).toThrow('首领配置缺失');
    } finally {
      stages[14].bossId = id;
    }
    for (let id = 11; id <= 15; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it.each([5, 10, 15])('第%s关首领弹道与残留统一结算护甲/易伤，仅记录实际损失', (stage) => {
    const { s, boss } = arena(stage);
    boss.frozenUntil = 10000;
    boss.vulnerabilityUntil = 10000;
    boss.vulnerabilityPercent = 20;
    const reduction = (bossDefinition(stage).damageReductionPercent ?? 0) / 100;
    s.released.push({
      shape: 'area',
      due: 0,
      damage: 101,
      kind: 'sword_eagle',
      source: 3,
      point: { x: boss.x, y: boss.y },
      target: boss.id,
      radius: 0.5,
    });
    stepCombat(s);
    const loss = Math.floor(101 * 1.2 * (1 - reduction));
    expect(boss.hp).toBe(boss.maxHp! - loss);
    expect(s.damageDone).toBe(loss);
    boss.hp = 3;
    s.time = 1000;
    s.fields.push({ id: 1, x: boss.x, y: boss.y, born: 0, damage: 101, hits: 0, source: 3 });
    stepCombat(s);
    expect(boss.hp).toBe(0);
    expect(s.damageDone).toBe(loss + 3);
    expect(s.report!.units.find((u) => u.id === 3)!.damageDone).toBe(loss + 3);
  });
  it('岩铠保底伤害为1', () => {
    const { s, boss } = arena();
    s.released.push({
      shape: 'area',
      due: 0,
      damage: 0.1,
      kind: 'sword_eagle',
      source: 3,
      point: { x: boss.x, y: boss.y },
      target: boss.id,
      radius: 0.5,
    });
    stepCombat(s);
    expect(s.damageDone).toBe(1);
  });
  it('横扫锁定前排并覆盖跨排占格；冻结延后预警，首领死后撤销未释放横扫', () => {
    const { s, boss } = arena();
    boss.nextCleave = 0;
    stepCombat(s);
    expect(s.warnings).toEqual([{ source: boss.id, row: 1, due: 1800 }]);
    s.time = 1800;
    boss.frozenUntil = 1900;
    const hp = s.allies.map((u) => u.hp);
    stepCombat(s);
    stepCombat(s);
    expect(s.allies.map((u) => u.hp)).toEqual(hp);
    expect(s.warnings[0].due).toBe(1900);
    stepCombat(s);
    expect(s.allies[1].hp).toBe(hp[1] - config.thirdBoss.cleaveHitDamage);
    expect(s.allies[0].hp).toBe(hp[0]);
    expect(s.allies[2].hp).toBe(hp[2]);
    s.warnings.push({ source: boss.id, row: 2, due: s.time });
    boss.hp = 0;
    collectDeaths(s);
    stepCombat(s);
    expect(s.allies[0].hp).toBe(hp[0]);
  });
  it('跨排灵兽覆盖预警行时一并受击', () => {
    const { s, boss } = arena();
    s.warnings.push({ source: boss.id, row: 2, due: 0 });
    const hp = s.allies.map((u) => u.hp);
    stepCombat(s);
    expect(s.allies.map((u) => u.hp)).toEqual([
      hp[0] - config.thirdBoss.cleaveHitDamage,
      hp[1] - config.thirdBoss.cleaveHitDamage,
      hp[2],
    ]);
  });
  it('18秒召两只，冻结延期不补发，上限6只；半血加速且父死孩子继续存活', () => {
    const { s, boss } = arena();
    expect(boss.nextSummon).toBe(18000);
    s.time = 18000;
    boss.frozenUntil = 18100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(2);
    expect(boss.nextSummon).toBe(36100);
    for (const time of [36100, 54100, 72100]) {
      s.time = time;
      stepCombat(s);
    }
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(6);
    boss.hp = boss.maxHp! / 2;
    boss.x = 2.5;
    boss.y = 1.5;
    boss.cooldown = 0;
    s.time = 72200;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(boss.cooldown).toBe(1250);
    boss.hp = 0;
    collectDeaths(s);
    s.time = 100000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(6);
  });
  it('v9第十关胜利档迁移后继续11关，原档备份、奖励不重领、免费刷新一次', () => {
    const old = won(10).exportSave();
    old.contentVersion = v9.contentVersion;
    const raw = JSON.stringify(old);
    const map = new Map([[SAVE_KEY, raw]]);
    const load = loadSession({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    });
    expect(load).toMatchObject({ recovered: true, blocked: false });
    expect([...map.values()]).toContain(raw);
    const s = load.session;
    expect(s.complete).toBe(false);
    expect(s.preparation).toEqual(old.preparation);
    const money = s.preparation.currency;
    const rng = s.preparation.rng;
    s.nextStage();
    expect(s.preparation.stageId).toBe(11);
    expect(s.preparation.currency).toBe(money);
    expect(s.preparation.rng).not.toBe(rng);
    const after = clone(s.preparation);
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation).toEqual(after);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it('15关失败/中止回滚；胜利后可继续16，存档往返不重复奖励', () => {
    const s = won(15);
    expect(s.complete).toBe(false);
    const save = s.exportSave();
    expect(validSave(save)).toBe(true);
    const restored = Session.restore(save);
    expect(restored.complete).toBe(false);
    restored.tick();
    expect(restored.preparation).toEqual(save.preparation);
    expect(restored.nextStage()).toBeNull();
    expect(restored.preparation.stageId).toBe(16);
    s.backToPreparation();
    const before = clone(s.preparation);
    s.start();
    s.battle!.income = 999;
    s.battle!.progression.buffs.attack = 10;
    s.backToPreparation();
    expect(s.preparation).toEqual(before);
    s.start();
    s.battle!.allies[0].hp = 0;
    s.tick();
    expect(s.phase).toBe('defeat');
    expect(s.retry()).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(s.battle!.income).toBe(0);
  });
});
