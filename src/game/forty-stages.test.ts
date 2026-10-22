import { historicalBalance } from './testing/legacy-approach';
import { describe, expect, it } from 'vitest';
import { bossDefinition, bossDescription, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import v14 from '../../docs/superpowers/specs/2026-10-21-prototype-balance-v14-snapshot.json';

function arena() {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ember_mouse', rank: 6, position: { x: 3, y: 2 } },
      { id: 3, kind: 'shield_fox', rank: 6, position: { x: 3, y: 4 } },
    ],
    { stageId: 40 },
  );
  s.spawns = [{ at: 179000, x: 0 }];
  s.allies.forEach((u) => {
    u.cooldown = 200000;
  });
  const boss = spawnEnemy(s, 'boss', { x: 3.5, y: 0.3 });
  boss.cooldown = 200000;
  return { s, boss };
}
function won(stageId: number) {
  const s = new Session(20261021);
  s.preparation.stageId = stageId;
  s.preparation.rewardedStages = Array.from({ length: stageId - 1 }, (_, i) => i + 1);
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  s.start();
  s.battle!.spawns = [];
  s.tick();
  expect(s.phase).toBe('victory');
  return s;
}

describe('四十关与玄甲咒尊', () => {
  it('排除已单测锁定的接敌距离和v18校准后前35关配置不变，八首领隔离，新五关每秒连续生成', () => {
    const { eighthBoss: _boss, ...old } = historicalBalance();
    expect({
      ...old,
      contentVersion: v14.contentVersion,
      status: v14.status,
      stages: old.stages.slice(0, 35),
      scope: v14.scope,
      waves: { ...old.waves, spawnRow: v14.waves.spawnRow },
    }).toEqual(v14);
    expect(stages.slice(0, 40).map((s) => s.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
    expect(config.scope.M2M3.stageIds).toEqual(stages.map((s) => s.id));
    expect(stages.filter((s) => s.id <= 40 && s.bossId).map((s) => s.id)).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40,
    ]);
    expect(bossDefinition(40)).toEqual(config.eighthBoss);
    expect(bossDefinition(35)).toEqual(config.seventhBoss);
    expect(bossName(40)).toBe('玄甲咒尊');
    expect(bossDescription(40)).toContain('岩铠减伤15%');
    expect(bossDescription(40)).toContain('每14秒召2只');
    expect(bossDescription(40)).toContain('远程射程2.2格');
    expect(bossDescription(40)).toContain('上限10只');
    expect(bossDescription(40)).toContain('每次召4只');
    for (let id = 36; id <= 40; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('远射停在2.2格，先前排低阶和仇恨，清排后再移动；冻结推迟前摇', () => {
    const { s, boss } = arena();
    s.allies[0].rank = 3;
    s.allies[1].rank = 1;
    boss.cooldown = 0;
    const start = { x: boss.x, y: boss.y };
    stepCombat(s);
    expect(boss.target).toBe(2);
    expect({ x: boss.x, y: boss.y }).toEqual(start);
    expect(s.attacks).toMatchObject([{ team: 'enemy', source: boss.id, target: 2 }]);
    const hp = s.allies[1].hp,
      due = s.attacks[0].due;
    boss.frozenUntil = due + 100;
    while (s.time <= due) stepCombat(s);
    expect(s.allies[1].hp).toBe(hp);
    while (s.attacks.length) stepCombat(s);
    expect(s.allies[1].hp).toBe(hp - config.eighthBoss.hitDamage);
    s.allies[0].rank = 1;
    boss.x = 1.5;
    boss.cooldown = 0;
    boss.recheckAt = 0;
    stepCombat(s);
    expect(boss.target).toBe(1);
    s.allies[0].hp = 0;
    boss.x = 3.5;
    boss.cooldown = 0;
    s.attacks = [];
    stepCombat(s);
    expect(boss.target).toBe(2);
    s.allies[1].hp = 0;
    boss.cooldown = 0;
    s.attacks = [];
    stepCombat(s);
    expect(boss.target).toBe(3);
    expect(boss.y).toBeGreaterThan(start.y);
    expect(s.attacks).toHaveLength(0);
    for (let i = 0; i < 200 && !s.attacks.length; i++) stepCombat(s);
    expect(s.attacks).toMatchObject([{ team: 'enemy', source: boss.id, target: 3 }]);
    expect(Math.hypot(boss.x - 3.5, boss.y - 4.5)).toBeCloseTo(2.2);
  });
  it('护甲与易伤乘算，最少1伤害、战报无过量伤害', () => {
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
  it('首领免疫鼠斩杀，不消耗斩杀随机数', () => {
    const { s, boss } = arena();
    s.allies[2].hp = 0;
    s.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
    boss.hp = 2000;
    const rng = s.rng;
    s.attacks = [{ team: 'ally', source: 2, target: boss.id, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(boss.hp).toBe(2000 - Math.floor(960 * 1.5 * 0.85));
    expect(s.rng).toBe(rng);
  });
  it('半血不重置14秒时钟，冻结延后召唤，上限10；父死孩子仍须清空', () => {
    const { s, boss } = arena();
    expect(boss.nextSummon).toBe(14000);
    boss.hp = boss.maxHp! / 2;
    s.time = 13000;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(boss.nextSummon).toBe(14000);
    expect(s.enemies).toHaveLength(1);
    s.time = 14000;
    boss.frozenUntil = 14100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(4);
    expect(boss.nextSummon).toBe(28100);
    s.time = 90000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    s.time = 120000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(10);
    boss.hp = 0;
    collectDeaths(s);
    s.time = 150000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(10);
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
  it('召唤剩两席只补两只，上限按父实例独立计算且满额不补发', () => {
    const { s, boss } = arena();
    boss.phase2 = true;
    boss.nextSummon = 0;
    for (let i = 0; i < 8; i++) spawnEnemy(s, 'summoned_wolf', { x: 0.5, y: 0 }, boss.id);
    const other = spawnEnemy(s, 'boss', { x: 5.5, y: 0 });
    other.cooldown = 200000;
    other.nextSummon = 0;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(10);
    expect(s.enemies.filter((e) => e.owner === other.id)).toHaveLength(2);
    expect(boss.nextSummon).toBe(14000);
    s.time = 14000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(10);
    expect(s.enemies.filter((e) => e.owner === other.id)).toHaveLength(4);
    expect(boss.nextSummon).toBe(28000);
  });
  it('横扫预警锁前排、冻结延期，半血普攻35%加速', () => {
    const { s, boss } = arena();
    boss.nextCleave = 0;
    stepCombat(s);
    expect(s.warnings).toEqual([{ source: boss.id, row: 2, due: 2000 }]);
    expect(boss.nextCleave).toBe(12000);
    const hp = s.allies.map((u) => u.hp);
    s.time = 2000;
    boss.frozenUntil = 2100;
    stepCombat(s);
    stepCombat(s);
    expect(s.allies.map((u) => u.hp)).toEqual(hp);
    stepCombat(s);
    expect(s.allies[0].hp).toBe(hp[0] - config.eighthBoss.cleaveHitDamage);
    expect(s.allies[1].hp).toBe(hp[1] - config.eighthBoss.cleaveHitDamage);
    expect(s.allies[2].hp).toBe(hp[2]);
    boss.hp = boss.maxHp! / 2;
    boss.x = 1.5;
    boss.y = 2.5;
    boss.cooldown = 0;
    stepCombat(s);
    expect(boss.cooldown).toBe(Math.ceil(config.eighthBoss.actionIntervalMs / 1.35 / 50) * 50);
  });
  it('v14旧35关胜利档先备份迁移，继续36不重领奖，只免费刷新一次', () => {
    const save = won(35).exportSave();
    save.contentVersion = v14.contentVersion;
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
    expect(
      [...map.entries()].some(([k, v]) => k.startsWith(`${SAVE_KEY}:backup:`) && v === raw),
    ).toBe(true);
    const s = loaded.session;
    expect(s.complete).toBe(false);
    expect(s.preparation).toEqual(save.preparation);
    const money = s.preparation.currency,
      rng = s.preparation.rng;
    expect(s.nextStage()).toBeNull();
    expect(s.preparation.stageId).toBe(36);
    expect(s.preparation.currency).toBe(money);
    expect(s.preparation.rng).not.toBe(rng);
    const after = clone(s.preparation);
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation).toEqual(after);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it.each(['backup', 'primary'])('v14迁移%s写入失败保留原主档，并阻止自动覆盖', (failure) => {
    const save = won(35).exportSave();
    save.contentVersion = v14.contentVersion;
    const raw = JSON.stringify(save),
      map = new Map([[SAVE_KEY, raw]]);
    const loaded = loadSession({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        if (failure === 'backup' || k === SAVE_KEY) throw new Error('quota');
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    });
    expect(loaded).toMatchObject({ recovered: true, blocked: true });
    expect(map.get(SAVE_KEY)).toBe(raw);
    expect(loaded.session.preparation).toEqual(save.preparation);
    expect(loaded.session.nextStage()).toBeNull();
    expect(loaded.session.preparation.stageId).toBe(36);
  });
  it('40可继续41，重载不重领奖，失败/中止回滚', () => {
    const s = won(40),
      save = s.exportSave();
    expect(s.complete).toBe(false);
    expect(validSave(save)).toBe(true);
    const loaded = Session.restore(save);
    expect(loaded.complete).toBe(false);
    expect(loaded.nextStage()).toBeNull();
    expect(loaded.preparation.stageId).toBe(41);
    expect(loaded.preparation.currency).toBe(save.preparation.currency);
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
