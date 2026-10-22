import { describe, expect, it } from 'vitest';
import { bossDefinition, bossDescription, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave, type StoragePort } from './persistence';
import v22 from '../../docs/superpowers/specs/2026-10-22-prototype-balance-v22-snapshot.json';

function arena(stageId = 45) {
  const battle = createCombat(
    [
      { id: 1, kind: 'scatter_bear', rank: 6, position: { x: 0, y: 0 } },
      { id: 2, kind: 'ember_mouse', rank: 6, position: { x: 2, y: 0 } },
      { id: 3, kind: 'fortune_peach', rank: 6, position: { x: 4, y: 2 } },
    ],
    { stageId },
  );
  battle.spawns = [{ at: 179000, x: 0 }];
  battle.allies.forEach((unit) => {
    unit.hp = unit.maxHp = 10000;
    unit.cooldown = 200000;
  });
  const boss = spawnEnemy(battle, 'boss', { x: 2.5, y: 0 });
  boss.cooldown = 200000;
  boss.nextSummon = 200000;
  boss.nextCleave = 0;
  return { battle, boss };
}
function won(stageId: number) {
  const session = new Session(20261022);
  session.preparation.stageId = stageId;
  session.preparation.rewardedStages = Array.from({ length: stageId - 1 }, (_, i) => i + 1);
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  expect(session.start()).toBeNull();
  session.battle!.spawns = [];
  session.tick();
  expect(session.phase).toBe('victory');
  return session;
}
function storage(raw: string, failure?: 'backup' | 'primary') {
  const map = new Map([[SAVE_KEY, raw]]);
  const port: StoragePort = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (failure && (failure === 'backup' || key === SAVE_KEY)) throw new Error('quota');
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { map, port };
}

describe('四十五关与回锋妖将 P', () => {
  it('完整前40配置保持v22，新增五关连续每秒出怪、九首领隔离', () => {
    const { ninthBoss: _ninthBoss, tenthBoss: _tenthBoss, ...prefix } = clone(config);
    expect({
      ...prefix,
      contentVersion: v22.contentVersion,
      status: v22.status,
      scope: {
        ...prefix.scope,
        M2M3: { ...prefix.scope.M2M3, stageIds: prefix.scope.M2M3.stageIds.slice(0, 40) },
      },
      stages: prefix.stages.slice(0, 40),
    }).toEqual(v22);
    expect(stages.slice(0, 45).map((stage) => stage.id)).toEqual(
      Array.from({ length: 45 }, (_, i) => i + 1),
    );
    expect(config.scope.M2M3.stageIds.slice(0, 45)).toEqual(
      stages.slice(0, 45).map((stage) => stage.id),
    );
    expect(bossDefinition(45)).toEqual(config.ninthBoss);
    expect(bossDefinition(40)).toEqual(config.eighthBoss);
    expect(bossName(45)).toBe('回锋妖将');
    expect(bossDescription(45)).toContain('双段横扫');
    expect(bossDescription(45)).toContain('不跳后排');
    for (let id = 41; id <= 45; id++) {
      const spawns = waveSpawns(id).filter((spawn) => spawn.kind !== 'boss');
      expect(spawns.map((spawn) => spawn.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('双段同时锁定前排行，首段和60%追击独立命中，跨两格每段只受一次', () => {
    const { battle, boss } = arena();
    stepCombat(battle);
    const first = clone(battle.warnings[0]);
    const echo = clone(battle.warnings[1]);
    expect(battle.warnings).toEqual([
      { source: boss.id, row: 0, due: config.ninthBoss.cleaveWarningMs },
      { source: boss.id, row: 0, due: config.ninthBoss.cleaveWarningMs + 900, echo: true },
    ]);
    battle.time = first.due - 50;
    stepCombat(battle);
    expect(battle.allies[0].hp).toBe(10000);
    stepCombat(battle);
    const damage = config.ninthBoss.cleaveHitDamage;
    expect(battle.allies.map((u) => u.hp)).toEqual([10000 - damage, 10000 - damage, 10000]);
    battle.time = echo.due;
    stepCombat(battle);
    expect(battle.allies.map((u) => u.hp)).toEqual([
      10000 - damage - Math.floor(damage * 0.6),
      10000 - damage - Math.floor(damage * 0.6),
      10000,
    ]);
    expect(battle.warnings).toEqual([]);
    expect(battle.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(battle.damageTaken);
  });
  it('首段清空整排后追击不切换后排；死首领撤销未释放第二段', () => {
    const { battle, boss } = arena();
    stepCombat(battle);
    battle.allies[0].hp = battle.allies[1].hp = 1;
    battle.time = battle.warnings[0].due;
    stepCombat(battle);
    expect(battle.allies.slice(0, 2).every((unit) => unit.hp === 0)).toBe(true);
    battle.time = battle.warnings[0].due;
    stepCombat(battle);
    expect(battle.allies[2].hp).toBe(10000);
    boss.nextCleave = battle.time;
    stepCombat(battle);
    expect(battle.warnings.every((warning) => warning.row === 2)).toBe(true);
    boss.hp = 0;
    battle.time = battle.warnings[1].due;
    stepCombat(battle);
    expect(battle.allies[2].hp).toBe(10000);
    expect(battle.warnings).toEqual([]);
  });
  it('冻结逐步推迟两段和技能时钟，不提前伤害；旧40关仍仅一段', () => {
    const { battle, boss } = arena();
    stepCombat(battle);
    const before = clone(battle.warnings);
    const cleave = boss.nextCleave!;
    boss.frozenUntil = battle.time + 100;
    stepCombat(battle);
    stepCombat(battle);
    expect(battle.warnings.map((warning) => warning.due)).toEqual(
      before.map((warning) => warning.due + 100),
    );
    expect(boss.nextCleave).toBe(cleave + 100);
    expect(battle.allies[0].hp).toBe(10000);
    const old = arena(40);
    stepCombat(old.battle);
    expect(old.battle.warnings).toHaveLength(1);
    expect(old.battle.warnings[0].echo).toBeUndefined();
  });
  it('半血不重置召唤时钟，2→4只按父实例上限8，30%攻速，近战仍选前排', () => {
    const { battle, boss } = arena();
    boss.nextCleave = 200000;
    boss.nextSummon = 18000;
    battle.time = 18000;
    stepCombat(battle);
    expect(battle.enemies.filter((enemy) => enemy.owner === boss.id)).toHaveLength(2);
    const next = boss.nextSummon;
    boss.hp = config.ninthBoss.hp / 2;
    stepCombat(battle);
    expect(boss.phase2).toBe(true);
    expect(boss.nextSummon).toBe(next);
    battle.time = next!;
    stepCombat(battle);
    expect(battle.enemies.filter((enemy) => enemy.owner === boss.id)).toHaveLength(6);
    battle.time = boss.nextSummon!;
    boss.cooldown = 0;
    stepCombat(battle);
    expect(battle.enemies.filter((enemy) => enemy.owner === boss.id)).toHaveLength(8);
    expect(boss.target).toBe(2);
    expect(boss.cooldown).toBe(Math.ceil(config.ninthBoss.actionIntervalMs / 1.3 / 50) * 50);
    expect(battle.attacks.some((attack) => attack.source === boss.id && attack.target === 2)).toBe(
      true,
    );
  });
  it('首领免疫鼠斩杀且不消耗斩杀随机数，父死保留召唤物并等待清场', () => {
    const { battle, boss } = arena();
    boss.nextCleave = 200000;
    boss.hp = 10000;
    battle.progression.buffs.mouse_finisher = 1;
    battle.progression.buffs.mouse_execute = 1;
    battle.allies[1].cooldown = 0;
    const rng = battle.rng;
    for (let i = 0; i < 20; i++) stepCombat(battle);
    expect(boss.hp).toBeGreaterThan(0);
    expect(battle.rng).toBe(rng);
    const child = spawnEnemy(battle, 'summoned_wolf', { x: 4, y: 0 }, boss.id);
    child.cooldown = 200000;
    boss.hp = 0;
    stepCombat(battle);
    expect(battle.enemies).toContain(child);
    expect(battle.result).toBeNull();
  });
  it('v22旧40胜利先备份再迁移，继续41不重领奖，只刷新一次招募', () => {
    const save = won(40).exportSave();
    save.contentVersion = v22.contentVersion;
    const raw = JSON.stringify(save),
      { map, port } = storage(raw);
    const loaded = loadSession(port);
    expect(loaded).toMatchObject({ recovered: true, blocked: false });
    expect(
      [...map.entries()].some(
        ([key, value]) => key.startsWith(`${SAVE_KEY}:backup:`) && value === raw,
      ),
    ).toBe(true);
    expect(loaded.session.preparation).toEqual(save.preparation);
    expect(loaded.session.complete).toBe(false);
    expect(loaded.session.nextStage()).toBeNull();
    expect(loaded.session.preparation.stageId).toBe(41);
    expect(loaded.session.preparation.currency).toBe(save.preparation.currency);
    expect(loaded.session.preparation.offers).toHaveLength(3);
    const after = clone(loaded.session.preparation);
    expect(loaded.session.nextStage()).toBeTruthy();
    expect(loaded.session.preparation).toEqual(after);
    expect(validSave(loaded.session.exportSave())).toBe(true);
  });
  it.each(['backup', 'primary'] as const)(
    'v22迁移%s写入失败保留原主档并停止自动覆盖',
    (failure) => {
      const save = won(40).exportSave();
      save.contentVersion = v22.contentVersion;
      const raw = JSON.stringify(save),
        { map, port } = storage(raw, failure);
      const loaded = loadSession(port);
      expect(loaded).toMatchObject({ recovered: true, blocked: true });
      expect(map.get(SAVE_KEY)).toBe(raw);
      expect(loaded.session.preparation).toEqual(save.preparation);
    },
  );
  it('旧45胜利重载不重复结算，可继续46；失败/返回/刷新回滚收益和成长', () => {
    const session = won(45),
      save = session.exportSave();
    expect(session.complete).toBe(false);
    expect(validSave(save)).toBe(true);
    const loaded = Session.restore(save);
    expect(loaded.complete).toBe(false);
    loaded.tick();
    expect(loaded.preparation).toEqual(save.preparation);
    expect(loaded.nextStage()).toBeNull();
    expect(loaded.preparation.stageId).toBe(46);
    expect(loaded.preparation.currency).toBe(save.preparation.currency);
    const next = clone(loaded.preparation);
    expect(loaded.nextStage()).toBeTruthy();
    expect(loaded.preparation).toEqual(next);
    session.backToPreparation();
    const before = clone(session.preparation);
    session.start();
    session.battle!.income = 999;
    session.battle!.progression.buffs.attack = 10;
    expect(session.exportSave().preparation).toEqual(before);
    session.backToPreparation();
    expect(session.preparation).toEqual(before);
    session.start();
    session.battle!.income = 999;
    session.battle!.allies[0].hp = 0;
    session.tick();
    expect(session.phase).toBe('defeat');
    expect(session.retry()).toBeNull();
    expect(session.preparation).toEqual(before);
    expect(session.battle!.income).toBe(0);
  });
});
