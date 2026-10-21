import { describe, expect, it } from 'vitest';
import { bossDefinition, bossDescription, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import v12 from '../../docs/superpowers/specs/2026-10-18-prototype-balance-v12-snapshot.json';

function arena() {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 3, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ember_mouse', rank: 1, position: { x: 3, y: 2 } },
      { id: 3, kind: 'shield_fox', rank: 1, position: { x: 3, y: 4 } },
    ],
    { stageId: 30 },
  );
  s.spawns = [{ at: 179000, x: 0 }];
  s.allies.forEach((u) => {
    u.cooldown = 200000;
  });
  const boss = spawnEnemy(s, 'boss', { x: 3.5, y: 0.1 });
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

describe('三十关与玄羽妖帅', () => {
  it('除接敌距离外前25关配置不变，六首领隔离，新五关每秒连续生成', () => {
    const { sixthBoss: _sixth, seventhBoss: _seventh, eighthBoss: _eighth, ...old } = config;
    expect({
      ...old,
      contentVersion: v12.contentVersion,
      status: v12.status,
      stages: old.stages.slice(0, 25),
      scope: v12.scope,
      waves: { ...old.waves, spawnRow: v12.waves.spawnRow },
    }).toEqual(v12);
    expect(stages.slice(0, 30).map((s) => s.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    expect(config.scope.M2M3.stageIds).toEqual(stages.map((s) => s.id));
    expect(
      stages
        .slice(0, 30)
        .filter((s) => s.bossId)
        .map((s) => s.id),
    ).toEqual([5, 10, 15, 20, 25, 30]);
    expect([5, 10, 15, 20, 25, 30].map(bossDefinition)).toEqual([
      config.boss,
      config.secondBoss,
      config.thirdBoss,
      config.fourthBoss,
      config.fifthBoss,
      config.sixthBoss,
    ]);
    expect(bossName(30)).toBe('玄羽妖帅');
    expect(bossDescription(30)).toContain('远程射程2.4格，仍先清前排');
    for (let id = 26; id <= 30; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('射程边界停止移动，先前排低阶、同阶按仇恨；前排清空才向后排靠近', () => {
    const { s, boss } = arena();
    boss.cooldown = 0;
    const start = { x: boss.x, y: boss.y };
    stepCombat(s);
    expect(boss.target).toBe(2);
    expect({ x: boss.x, y: boss.y }).toEqual(start);
    expect(s.attacks).toMatchObject([{ team: 'enemy', source: boss.id, target: 2 }]);
    s.allies[0].rank = 1;
    boss.x = 1.5;
    boss.recheckAt = 0;
    boss.cooldown = 0;
    s.attacks = [];
    stepCombat(s);
    expect(boss.target).toBe(1);
    s.allies[0].hp = 0;
    boss.x = 3.5;
    boss.recheckAt = 0;
    boss.cooldown = 0;
    s.attacks = [];
    stepCombat(s);
    expect(boss.target).toBe(2);
    s.allies[1].hp = 0;
    boss.recheckAt = 0;
    boss.cooldown = 0;
    s.attacks = [];
    stepCombat(s);
    expect(boss.target).toBe(3);
    expect(boss.y).toBeGreaterThan(start.y);
    expect(s.attacks).toHaveLength(0);
    for (let i = 0; i < 160 && !s.attacks.length; i++) stepCombat(s);
    expect(s.attacks).toMatchObject([{ team: 'enemy', source: boss.id, target: 3 }]);
    expect(Math.hypot(boss.x - 3.5, boss.y - 4.5)).toBeCloseTo(2.4);
  });
  it('冻结推迟远射前摇，解冻才命中；首领无护甲且免疫鼠斩杀', () => {
    const { s, boss } = arena();
    s.allies[1].hp = s.allies[1].maxHp = 500;
    boss.cooldown = 0;
    stepCombat(s);
    const hp = s.allies[1].hp;
    const due = s.attacks[0].due;
    boss.frozenUntil = due + 100;
    while (s.time <= due) stepCombat(s);
    expect(s.allies[1].hp).toBe(hp);
    while (s.time <= s.attacks[0].due) {
      stepCombat(s);
      if (!s.attacks.length) break;
    }
    expect(s.allies[1].hp).toBe(hp - config.sixthBoss.hitDamage);
    s.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
    boss.hp = 2000;
    s.attacks = [{ team: 'ally', source: 2, target: boss.id, ordinal: 1, due: s.time }];
    const rng = s.rng;
    stepCombat(s);
    expect(boss.hp).toBe(1910);
    expect(s.rng).toBe(rng);
  });
  it('半血不重置20秒时钟，冻结推迟召唤、上限8、父死保留孩子且必须清场', () => {
    const { s, boss } = arena();
    expect(boss.nextSummon).toBe(20000);
    boss.hp = boss.maxHp! / 2;
    s.time = 19000;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(boss.nextSummon).toBe(20000);
    expect(s.enemies).toHaveLength(1);
    s.time = 20000;
    boss.frozenUntil = 20100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(4);
    expect(boss.nextSummon).toBe(40100);
    s.time = 100000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    boss.hp = 0;
    collectDeaths(s);
    s.time = 130000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    expect(s.result).toBeNull();
    s.spawns = [];
    s.enemies.forEach((e) => {
      e.hp = 0;
    });
    collectDeaths(s);
    s.attacks = [];
    s.warnings = [];
    stepCombat(s);
    expect(s.result).toBe('victory');
  });
  it('横扫预警仍锁前排，冻结延期，半血远射普攻30%加速', () => {
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
    expect(s.allies.map((u) => u.hp)).toEqual([
      hp[0] - config.sixthBoss.cleaveHitDamage,
      Math.max(0, hp[1] - config.sixthBoss.cleaveHitDamage),
      hp[2],
    ]);
    boss.hp = boss.maxHp! / 2;
    boss.x = 1.5;
    boss.cooldown = 0;
    stepCombat(s);
    expect(boss.cooldown).toBe(950);
  });
  it('v12第25关完成档先备份迁移，继续26且只刷新一次、不重领奖', () => {
    const save = won(25).exportSave();
    save.contentVersion = v12.contentVersion;
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
    expect(s.preparation.stageId).toBe(26);
    expect(s.preparation.currency).toBe(money);
    expect(s.preparation.rng).not.toBe(rng);
    const after = clone(s.preparation);
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation).toEqual(after);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it('旧30关重载不重复奖励，可继续31，失败与中止回滚', () => {
    const s = won(30),
      save = s.exportSave();
    expect(s.complete).toBe(false);
    expect(validSave(save)).toBe(true);
    const loaded = Session.restore(save);
    expect(loaded.complete).toBe(false);
    loaded.tick();
    expect(loaded.preparation).toEqual(save.preparation);
    expect(loaded.nextStage()).toBeNull();
    expect(loaded.preparation.stageId).toBe(31);
    s.backToPreparation();
    const before = clone(s.preparation);
    s.start();
    s.battle!.income = 999;
    s.battle!.progression.buffs.attack = 10;
    s.backToPreparation();
    expect(s.preparation).toEqual(before);
    s.start();
    s.battle!.income = 999;
    s.battle!.allies.forEach((u) => {
      u.hp = 0;
    });
    s.tick();
    expect(s.phase).toBe('defeat');
    expect(s.retry()).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(s.battle!.income).toBe(0);
  });
});
