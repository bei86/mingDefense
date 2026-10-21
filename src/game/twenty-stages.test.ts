import { historicalBalance } from './testing/legacy-approach';
import { describe, expect, it } from 'vitest';
import { bossDefinition, bossDescription, bossName, clone, config, stages } from './content';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, spawnEnemy } from './combat-skills';
import { Session } from './session';
import { loadSession, SAVE_KEY, validSave } from './persistence';
import v10 from '../../docs/superpowers/specs/2026-10-18-prototype-balance-v10-snapshot.json';

function arena(stageId = 20) {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 4 } },
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

describe('二十关与霜咒祭司', () => {
  it('排除已单测锁定的接敌距离和v18校准后前十五关配置不变，关卡和四首领引用完整，每秒连续出怪', () => {
    const {
      fourthBoss: _boss,
      fifthBoss: _fifth,
      sixthBoss: _sixth,
      seventhBoss: _seventh,
      eighthBoss: _eighth,
      ...old
    } = historicalBalance();
    expect({
      ...old,
      contentVersion: v10.contentVersion,
      status: v10.status,
      stages: old.stages.slice(0, 15),
      scope: v10.scope,
      waves: { ...old.waves, spawnRow: v10.waves.spawnRow },
    }).toEqual(v10);
    expect(stages.slice(0, 20).map((s) => s.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(config.scope.M2M3.stageIds).toEqual(stages.map((s) => s.id));
    expect(
      stages
        .slice(0, 20)
        .filter((s) => s.bossId)
        .map((s) => s.id),
    ).toEqual([5, 10, 15, 20]);
    expect(bossDefinition(20)).toBe(config.fourthBoss);
    expect(bossName(20)).toBe('霜咒祭司');
    expect(bossDescription(20)).toContain('每次召4只');
    for (let id = 16; id <= 20; id++) {
      const spawns = waveSpawns(id).filter((e) => e.kind !== 'boss');
      expect(spawns.map((e) => e.at)).toEqual(spawns.map((_, i) => i * 1000));
    }
  });
  it('出生从零计时，半血不立即白送一波，后续每次4只且总上限8', () => {
    const { s, boss } = arena();
    expect(boss.nextSummon).toBe(16000);
    expect(boss.maxHp).toBe(config.fourthBoss.hp);
    s.time = 16000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(2);
    boss.hp = boss.maxHp! / 2;
    s.time = 17000;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(boss.nextSummon).toBe(32000);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(2);
    s.time = 32000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(6);
    s.time = 48000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    s.time = 64000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
    const child = s.enemies.find((e) => e.owner === boss.id)!;
    child.hp = 0;
    collectDeaths(s);
    expect(s.xpEarned).toBe(0);
    s.time = 80000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(8);
  });
  it('恰逢召唤前已半血用4只；同tick受击才跨半血则本波2只，下波4只', () => {
    const before = arena();
    before.boss.hp = before.boss.maxHp! / 2;
    before.s.time = 16000;
    stepCombat(before.s);
    expect(before.s.enemies.filter((e) => e.owner === before.boss.id)).toHaveLength(4);
    const after = arena();
    after.boss.hp = after.boss.maxHp! / 2 + 1;
    after.s.time = 16000;
    after.s.released.push({
      shape: 'area',
      due: 16000,
      damage: 10,
      kind: 'sword_eagle',
      source: 2,
      point: { x: after.boss.x, y: after.boss.y },
      target: after.boss.id,
      radius: 0.5,
    });
    stepCombat(after.s);
    expect(after.boss.phase2).toBe(true);
    expect(after.boss.nextSummon).toBe(32000);
    expect(after.s.enemies.filter((e) => e.owner === after.boss.id)).toHaveLength(2);
    after.s.time = 32000;
    stepCombat(after.s);
    expect(after.s.enemies.filter((e) => e.owner === after.boss.id)).toHaveLength(6);
  });
  it('冻结推迟时钟、解冻不补积压，父死保留孩子但不再召唤', () => {
    const { s, boss } = arena();
    s.time = 16000;
    boss.frozenUntil = 16100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(boss.nextSummon).toBe(32100);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(2);
    s.time = 100000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(4);
    boss.hp = 0;
    collectDeaths(s);
    s.time = 150000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(4);
  });
  it('召唤上限按父实例计算，孩子出生当步不行动', () => {
    const { s, boss } = arena();
    const second = spawnEnemy(s, 'boss', { x: 0.5, y: 0 });
    boss.hp = boss.maxHp! / 2;
    second.hp = second.maxHp! / 2;
    s.time = 16000;
    stepCombat(s);
    for (const parent of [boss, second]) {
      const children = s.enemies.filter((e) => e.owner === parent.id);
      expect(children).toHaveLength(4);
      expect(children.every((e) => e.target === null && e.born === 16000)).toBe(true);
    }
  });
  it.each([5, 10, 15])('第%s关没有二阶段召唤数量覆盖，保留原数量', (stageId) => {
    const { s, boss } = arena(stageId);
    const skill = bossDefinition(stageId);
    boss.hp = (skill.hp * skill.phase2HpPercent) / 100;
    boss.nextSummon = 0;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(skill.summonCount);
  });
  it('横扫预警2秒，冻结延期且只伤预警排；半血普攻加速', () => {
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
    expect(s.allies[0].hp).toBe(hp[0] - config.fourthBoss.cleaveHitDamage);
    expect(s.allies[1].hp).toBe(hp[1]);
    boss.hp = boss.maxHp! / 2;
    boss.x = 1.5;
    boss.y = 2.5;
    boss.cooldown = 0;
    stepCombat(s);
    expect(boss.cooldown).toBe(1200);
  });
  it('霜咒祭司免疫斩杀且无护甲，不消耗斩杀随机数', () => {
    const s = createCombat([{ id: 1, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 4 } }], {
      stageId: 20,
      rng: 1,
    });
    s.spawns = [];
    s.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
    s.allies[0].cooldown = 200000;
    const boss = spawnEnemy(s, 'boss', { x: 1.5, y: 3.5 });
    boss.hp = 2000;
    s.attacks = [{ team: 'ally', source: 1, target: boss.id, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(boss.hp).toBe(1910);
    expect(s.rng).toBe(1);
  });
  it('v10十五关胜利档迁移可继续16，奖励不重领、只刷新一次', () => {
    const save = won(15).exportSave();
    save.contentVersion = v10.contentVersion;
    const raw = JSON.stringify(save);
    const map = new Map([[SAVE_KEY, raw]]);
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
    expect(s.preparation.stageId).toBe(16);
    expect(s.preparation.currency).toBe(money);
    expect(s.preparation.rng).not.toBe(rng);
    const after = clone(s.preparation);
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation).toEqual(after);
    expect(validSave(s.exportSave())).toBe(true);
  });
  it('20关可继续21，重载不重复领奖，失败和中止回滚', () => {
    const s = won(20),
      save = s.exportSave();
    expect(s.complete).toBe(false);
    expect(validSave(save)).toBe(true);
    const loaded = Session.restore(save);
    expect(loaded.complete).toBe(false);
    loaded.tick();
    expect(loaded.preparation).toEqual(save.preparation);
    expect(loaded.nextStage()).toBeNull();
    expect(loaded.preparation.stageId).toBe(21);
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
