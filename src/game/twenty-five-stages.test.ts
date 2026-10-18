import { describe, expect, it } from 'vitest';
import { bossDefinition, bossDescription, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import v11 from '../../docs/superpowers/specs/2026-10-18-prototype-balance-v11-snapshot.json';

function arena() {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 4 } },
    ],
    { stageId: 25 },
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

describe('二十五关与岩咒督军', () => {
  it('前20关完整配置不变，五首领隔离，新增五关每秒连续生成', () => {
    const { fifthBoss: _fifth, ...old } = config;
    expect({
      ...old,
      contentVersion: v11.contentVersion,
      status: v11.status,
      stages: old.stages.slice(0, 20),
      scope: v11.scope,
    }).toEqual(v11);
    expect(stages.map((s) => s.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(config.scope.M2M3.stageIds).toEqual(stages.map((s) => s.id));
    expect(stages.filter((s) => s.bossId).map((s) => s.id)).toEqual([5, 10, 15, 20, 25]);
    expect([5, 10, 15, 20, 25].map(bossDefinition)).toEqual([
      config.boss,
      config.secondBoss,
      config.thirdBoss,
      config.fourthBoss,
      config.fifthBoss,
    ]);
    expect(bossName(25)).toBe('岩咒督军');
    expect(bossDescription(25)).toContain('岩铠减伤15%');
    expect(bossDescription(25)).toContain('每次召4只');
    for (let id = 21; id <= 25; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('护甲与易伤乘算、最少1伤害，战报仅记录实际生命损失', () => {
    const { s, boss } = arena();
    boss.frozenUntil = 10000;
    boss.vulnerabilityUntil = 10000;
    boss.vulnerabilityPercent = 20;
    const hit = (damage: number) =>
      s.released.push({
        shape: 'area',
        due: s.time,
        damage,
        kind: 'sword_eagle',
        source: 2,
        point: { x: boss.x, y: boss.y },
        target: boss.id,
        radius: 0.5,
      });
    hit(101);
    stepCombat(s);
    const loss = Math.floor(101 * 1.2 * 0.85);
    expect(boss.hp).toBe(boss.maxHp! - loss);
    hit(0.1);
    stepCombat(s);
    expect(boss.hp).toBe(boss.maxHp! - loss - 1);
    boss.hp = 3;
    hit(100);
    stepCombat(s);
    expect(boss.hp).toBe(0);
    expect(s.damageDone).toBe(loss + 4);
    expect(s.report!.units.find((u) => u.id === 2)!.damageDone).toBe(loss + 4);
  });
  it('首领免疫鼠斩杀且不消耗斩杀随机数，普通伤害仍经过护甲', () => {
    const { s, boss } = arena();
    s.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
    boss.x = 1.5;
    boss.y = 3.5;
    boss.hp = 2000;
    const rng = s.rng;
    s.attacks = [{ team: 'ally', source: 2, target: boss.id, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(boss.hp).toBe(2000 - Math.floor(960 * 1.5 * 0.85));
    expect(s.rng).toBe(rng);
  });
  it('半血到期只召本次4只；冻结延时且不补积压，父死不删除孩子', () => {
    const { s, boss } = arena();
    expect(boss.nextSummon).toBe(18000);
    boss.hp = boss.maxHp! / 2;
    s.time = 17000;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(boss.nextSummon).toBe(18000);
    expect(s.enemies).toHaveLength(1);
    s.time = 18000;
    boss.frozenUntil = 18100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(4);
    expect(boss.nextSummon).toBe(36100);
    s.time = 90000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    s.time = 120000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    boss.hp = 0;
    collectDeaths(s);
    s.time = 150000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
  });
  it('横扫预警锁前排、冻结延期，半血普攻按30%加速', () => {
    const { s, boss } = arena();
    boss.nextCleave = 0;
    stepCombat(s);
    expect(s.warnings).toEqual([{ source: boss.id, row: 2, due: 2000 }]);
    const hp = s.allies.map((u) => u.hp);
    s.time = 2000;
    boss.frozenUntil = 2100;
    stepCombat(s);
    stepCombat(s);
    expect(s.allies.map((u) => u.hp)).toEqual(hp);
    stepCombat(s);
    expect(s.allies[0].hp).toBe(hp[0] - config.fifthBoss.cleaveHitDamage);
    expect(s.allies[1].hp).toBe(hp[1]);
    boss.hp = boss.maxHp! / 2;
    boss.x = 1.5;
    boss.y = 2.5;
    boss.cooldown = 0;
    stepCombat(s);
    expect(boss.cooldown).toBe(1200);
  });
  it('v11第20关完成档先备份迁移，继续21且只刷新一次、不重领奖', () => {
    const save = won(20).exportSave();
    save.contentVersion = v11.contentVersion;
    const raw = JSON.stringify(save),
      map = new Map([[SAVE_KEY, raw]]);
    const loaded = loadSession({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    });
    expect(loaded).toMatchObject({ recovered: true, blocked: false });
    expect([...map.values()]).toContain(raw);
    const s = loaded.session;
    expect(s.complete).toBe(false);
    expect(s.preparation).toEqual(save.preparation);
    const money = s.preparation.currency,
      rng = s.preparation.rng;
    expect(s.nextStage()).toBeNull();
    expect(s.preparation.stageId).toBe(21);
    expect(s.preparation.currency).toBe(money);
    expect(s.preparation.rng).not.toBe(rng);
    const after = clone(s.preparation);
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation).toEqual(after);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it('25是最终点，重载不重复奖励，失败与中止回滚', () => {
    const s = won(25),
      save = s.exportSave();
    expect(s.complete).toBe(true);
    expect(validSave(save)).toBe(true);
    const loaded = Session.restore(save);
    expect(loaded.complete).toBe(true);
    expect(loaded.nextStage()).toBeTruthy();
    loaded.tick();
    expect(loaded.preparation).toEqual(save.preparation);
    s.backToPreparation();
    const before = clone(s.preparation);
    s.start();
    s.battle!.income = 999;
    s.battle!.progression.buffs.attack = 10;
    s.backToPreparation();
    expect(s.preparation).toEqual(before);
    s.start();
    s.battle!.income = 999;
    s.battle!.allies[0].hp = 0;
    s.tick();
    expect(s.phase).toBe('defeat');
    expect(s.retry()).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(s.battle!.income).toBe(0);
  });
});
