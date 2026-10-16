import { describe, expect, it } from 'vitest';
import { clone, config, heroIds, heroes, stages } from './content';
import {
  createCombat,
  stepCombat,
  chooseCombatBuff,
  waveSpawns,
  type Combat,
  type Enemy,
} from './combat';
import { maxHeroHp, offerNextBuff, spawnEnemy } from './combat-skills';
import {
  bonus,
  buffDefinitions,
  drawBuffs,
  eligibleBuffs,
  gainExperience,
  initialProgression,
  threshold,
} from './progression';
import { Session } from './session';
import type { BuffId, Unit } from './model';
import { GameClock } from './clock';

const u = (kind: Unit['kind'], rank = 1, id = 1, x = 1, y = 3): Unit => ({
  id,
  kind,
  rank,
  position: { x, y },
});
function isolated(unit = u('ember_mouse'), stageId = 1): Combat {
  const s = createCombat([unit], { stageId });
  s.spawns = [{ at: 100000, x: 1.5 }];
  s.allies[0].cooldown = 100000;
  return s;
}
function dummy(s: Combat, hp = 10000, kind: Enemy['kind'] = 'wolf') {
  const e = spawnEnemy(s, kind!, { x: 1.5, y: 3.5 });
  e.hp = hp;
  e.maxHp = hp;
  e.cooldown = 100000;
  return e;
}
function tutorial() {
  const s = new Session();
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id });
  s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
  s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  return s;
}
function finish(session: Session) {
  for (let n = 0; n < 10000; n++) {
    if (session.hasChoices) session.chooseBuff(session.battle!.choices[0]);
    else if (session.phase === 'combat') session.tick();
    else return;
  }
  throw new Error('战斗或天赋队列未结束');
}

describe('成长与内容', () => {
  it('六英雄六阶配置、混合波次及Boss数值入口', () => {
    expect(heroIds).toHaveLength(6);
    for (const id of heroIds) expect(heroes[id].hp).toHaveLength(6);
    expect(stages.map((s) => waveSpawns(s.id).length)).toEqual([18, 28, 26, 26, 9]);
    expect(
      waveSpawns(2)
        .slice(0, 4)
        .map((s) => s.kind),
    ).toEqual(['runner', 'wolf', 'runner', 'wolf']);
    const s = isolated(u('ember_mouse'), 4);
    const croc = spawnEnemy(s, 'croc', { x: 0, y: 0 });
    expect(croc.hp).toBe(840);
    const b = isolated(u('ember_mouse'), 5);
    expect(spawnEnemy(b, 'boss', { x: 0, y: 0 }).hp).toBe(72000);
  });
  it('一次经验跨多个等级并保留多余经验', () => {
    const p = initialProgression(1);
    expect(gainExperience(p, 250)).toBe(3);
    expect(p).toMatchObject({ level: 4, xp: 10 });
    expect(threshold(11)).toBe(360);
    expect(threshold(12)).toBe(400);
  });
  it('天赋池过滤未上阵、低阶、前置、阶段和上限，三选不重复', () => {
    const p = initialProgression(1);
    const units = [
      u('ember_mouse'),
      u('sword_eagle', 2, 2),
      { ...u('shield_fox', 5, 3), position: null },
    ];
    expect(eligibleBuffs(p, units, 1)).not.toContain('fox_shield');
    expect(eligibleBuffs(p, units, 1)).not.toContain('eagle_residue');
    expect(eligibleBuffs(p, units, 5)).not.toContain('mouse_execute');
    units[1].rank = 3;
    expect(eligibleBuffs(p, units, 1)).toContain('eagle_residue');
    p.buffs.mouse_finisher = 1;
    expect(eligibleBuffs(p, units, 6)).toContain('mouse_execute');
    p.buffs.attack = 10;
    expect(eligibleBuffs(p, units, 1)).not.toContain('attack');
    const a = clone(p);
    const b = clone(p);
    expect(drawBuffs(a, units, 1)).toEqual(drawBuffs(b, units, 1));
    expect(new Set(drawBuffs(a, units, 1)).size).toBe(3);
  });
  it('池不足显示真实数量，空池每级换5钱，连续队列不死锁', () => {
    const s = isolated();
    s.progressionEnabled = true;
    for (const id of Object.keys(buffDefinitions) as BuffId[])
      s.progression.buffs[id] = buffDefinitions[id].maxLevel;
    s.progression.buffs.attack = 9;
    s.pendingChoices = 3;
    offerNextBuff(s);
    expect(s.choices).toEqual(['attack']);
    chooseCombatBuff(s, 'attack');
    expect(s.pendingChoices).toBe(0);
    expect(s.fallbackIncome).toBe(10);
    expect(s.choices).toEqual([]);
  });
  it('生命天赋只为存活单位补足最大生命增量，不复活', () => {
    const s = createCombat([u('ember_mouse'), u('boar', 1, 2)]);
    s.allies[0].hp = 60;
    s.allies[1].hp = 0;
    s.pendingChoices = 1;
    s.choices = ['health'];
    chooseCombatBuff(s, 'health');
    expect(s.allies[0]).toMatchObject({ hp: 78, maxHp: 138 });
    expect(s.allies[1]).toMatchObject({ hp: 0, maxHp: 230 });
  });
  it('商店、天赋和战斗随机状态独立，满格只抽英雄', () => {
    const s = tutorial();
    const before = clone(s.preparation.progression);
    const combatRng = s.preparation.combatRng;
    s.refresh(true);
    expect(s.preparation.progression).toEqual(before);
    expect(s.preparation.combatRng).toBe(combatRng);
    s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
    s.preparation.currency = 1500;
    for (let i = 0; i < 40; i++) {
      s.refresh(true);
      expect(s.preparation.offers.every((o) => o.kind !== 'cell')).toBe(true);
    }
  });
  it('合成开放到六阶，六阶后原子拒绝', () => {
    const s = tutorial();
    const target = s.preparation.units[0];
    target.rank = 5;
    s.preparation.units.push({ ...target, id: 90, position: null });
    expect(s.transfer({ type: 'unit', id: 90 }, { merge: target.id })).toBeNull();
    expect(s.preparation.units[0].rank).toBe(6);
    s.preparation.units.push({ ...s.preparation.units[0], id: 91, position: null });
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'unit', id: 91 }, { merge: target.id })).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
});

describe('新增英雄与伤害技能', () => {
  it('桃只在战斗中存活时产钱，备战桃不进入战斗', () => {
    const s = isolated(u('fortune_peach', 5));
    s.time = 5950;
    stepCombat(s);
    expect(s.income).toBe(0);
    stepCombat(s);
    expect(s.income).toBe(1);
    s.allies[0].hp = 0;
    s.result = null;
    s.time = 12000;
    stepCombat(s);
    expect(s.income).toBe(1);
    expect(createCombat([{ ...u('fortune_peach'), position: null }]).allies).toHaveLength(0);
  });
  it('狐初始能量只计算上阵五阶，盾量/上限/到期正确，按低盾比例选目标', () => {
    const s = createCombat([
      u('shield_fox', 5),
      u('boar', 1, 2),
      { ...u('shield_fox', 5, 3), position: null },
    ]);
    s.spawns = [{ at: 100000, x: 1.5 }];
    s.allies.forEach((u) => (u.cooldown = 100000));
    expect(s.energy).toBe(15);
    s.progression.buffs.fox_shield = 1;
    s.attacks = [{ team: 'ally', source: 1, target: 2, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(s.allies[1].shield).toBe(6); // floor(200×3%×1.08)
    for (let i = 0; i < 20; i++) {
      s.attacks = [{ team: 'ally', source: 1, target: 2, ordinal: i + 2, due: s.time }];
      stepCombat(s);
    }
    expect(s.allies[1].shield).toBe(60);
    s.time += 6000;
    stepCombat(s);
    expect(s.allies[1].shield).toBe(0);
  });
  it('护盾先承伤，狐光环不叠加且死亡后停止', () => {
    const s = isolated();
    const e = dummy(s);
    s.allies[0].shield = 10;
    s.allies[0].shieldExpires = 10000;
    s.attacks = [{ team: 'enemy', source: e.id, target: 1, ordinal: 0, due: 0 }];
    stepCombat(s);
    expect(s.allies[0].hp).toBe(116);
    expect(s.allies[0].shield).toBe(0);
    const b = createCombat([u('ember_mouse'), u('shield_fox', 3, 2), u('shield_fox', 3, 3)]);
    b.spawns = [{ at: 100000, x: 0 }];
    b.allies.forEach((u) => (u.cooldown = 100000));
    const target = dummy(b);
    b.attacks = [{ team: 'ally', source: 1, target: target.id, ordinal: 1, due: 0 }];
    stepCombat(b);
    expect(target.hp).toBe(9934);
    b.allies[1].hp = 0;
    b.allies[2].hp = 0;
    b.attacks = [{ team: 'ally', source: 1, target: target.id, ordinal: 2, due: b.time }];
    stepCombat(b);
    expect(target.hp).toBe(9874);
  });
  it('鱼第三击冰冻，Boss时长减半，冻结暂停移动/前摇', () => {
    const s = isolated(u('ice_fish', 3));
    const e = dummy(s);
    s.attacks = [{ team: 'ally', source: 1, target: e.id, ordinal: 3, due: 0 }];
    stepCombat(s);
    expect(e.frozenUntil).toBe(500);
    expect(e.slowUntil).toBe(1500);
    e.x = 5;
    const before = e.x;
    const cd = e.cooldown;
    s.attacks.push({ team: 'enemy', source: e.id, target: 1, ordinal: 0, due: 100 });
    stepCombat(s);
    expect(e.x).toBe(before);
    expect(e.cooldown).toBe(cd);
    expect(s.attacks.find((a) => a.team === 'enemy')!.due).toBe(150);
    const b = isolated(u('ice_fish', 3), 5);
    const boss = dummy(b, config.boss.hp, 'boss');
    b.attacks = [{ team: 'ally', source: 1, target: boss.id, ordinal: 3, due: 0 }];
    stepCombat(b);
    expect(boss.frozenUntil).toBe(250);
  });
  it('鹰五阶双段已发出后独立命中，只生成一个剑阵', () => {
    const s = createCombat([u('sword_eagle', 5), u('ember_mouse', 1, 2)]);
    s.spawns = [{ at: 100000, x: 0 }];
    s.allies.forEach((u) => (u.cooldown = 100000));
    const e = dummy(s);
    s.attacks = [{ team: 'ally', source: 1, target: e.id, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(e.hp).toBe(9520);
    expect(s.fields).toHaveLength(1);
    s.allies[0].hp = 0;
    stepCombat(s);
    stepCombat(s);
    expect(e.hp).toBe(9040);
    expect(s.fields).toHaveLength(1);
  });
  it('猪五阶每第二击强化，鳄减伤15%，通用与专属加成相加', () => {
    const s = isolated(u('boar', 5));
    const e = dummy(s, 10000, 'croc');
    s.progression.buffs.attack = 1;
    s.progression.buffs.boar_attack = 1;
    s.attacks = [{ team: 'ally', source: 1, target: e.id, ordinal: 2, due: 0 }];
    stepCombat(s);
    expect(e.hp).toBe(
      10000 - Math.floor(800 * 1.22 * 1.5 * 0.85) - Math.floor(((800 * 1.22 * 5) / 6) * 0.85),
    );
  });
});

describe('Boss、关间和暂停事务', () => {
  it('Boss横扫预警1200ms，覆盖目标行占地，死亡取消未释放横扫', () => {
    const s = isolated(u('sword_eagle', 3), 5);
    const boss = dummy(s, config.boss.hp, 'boss');
    boss.nextCleave = 0;
    stepCombat(s);
    expect(s.warnings).toMatchObject([{ row: 3, due: 1200 }]);
    const hp = s.allies[0].hp;
    for (let i = 0; i < 23; i++) stepCombat(s);
    expect(s.allies[0].hp).toBe(hp);
    stepCombat(s);
    expect(s.allies[0].hp).toBe(hp - config.boss.cleaveHitDamage);
    s.warnings.push({ source: boss.id, row: 3, due: s.time + 100 });
    boss.hp = 0;
    stepCombat(s);
    expect(s.warnings).toHaveLength(0);
  });
  it('Boss低于40%立即召两只、上限6；召唤无经验能量且必须清理', () => {
    const s = isolated(u('ember_mouse', 6), 5);
    const boss = dummy(s, config.boss.hp, 'boss');
    boss.hp = config.boss.hp * 0.4;
    stepCombat(s);
    expect(boss.phase2).toBe(true);
    expect(s.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(2);
    for (let i = 0; i < 5; i++) {
      boss.nextSummon = s.time;
      stepCombat(s);
    }
    expect(s.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(6);
    s.spawns = [];
    s.spawnIndex = 0;
    boss.hp = 0;
    stepCombat(s);
    expect(s.result).toBeNull();
    expect(s.energy).toBe(0);
    expect(s.xpEarned).toBe(30);
    for (const e of s.enemies) e.hp = 0;
    stepCombat(s);
    expect(s.xpEarned).toBe(30);
    expect(s.energy).toBe(0);
  });
  it('Boss被冻结时延后召唤，解冻后才释放技能', () => {
    const s = isolated(u('ice_fish', 3), 5);
    const boss = dummy(s, config.boss.hp, 'boss');
    boss.hp = config.boss.hp * 0.4;
    boss.frozenUntil = 250;
    for (let i = 0; i < 5; i++) stepCombat(s);
    expect(s.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(0);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(2);
  });
  it('天赋弹出冻结时钟并清除长按；失败不打开同tick升级', () => {
    const s = tutorial();
    s.start();
    s.held = true;
    while (!s.hasChoices && s.phase === 'combat') s.tick();
    expect(s.hasChoices).toBe(true);
    expect(s.held).toBe(false);
    const before = s.battle!.time;
    const clock = new GameClock(s);
    clock.advance(0);
    clock.advance(10000);
    expect(s.battle!.time).toBe(before);
    const b = isolated();
    b.progressionEnabled = true;
    b.progression.xp = 55;
    b.allies[0].hp = 14;
    const e = dummy(b, 60);
    b.attacks = [
      { team: 'ally', source: 1, target: e.id, ordinal: 1, due: 0 },
      { team: 'enemy', source: e.id, target: 1, ordinal: 0, due: 0 },
    ];
    stepCombat(b);
    expect(b.result).toBe('defeat');
    expect(b.choices).toEqual([]);
  });
  it('通关跨关免费刷新招募，保留阵容/格子/天赋，全员恢复且不能重复推进', () => {
    const s = tutorial();
    const offers = clone(s.preparation.offers);
    s.start();
    finish(s);
    expect(s.phase).toBe('victory');
    expect(s.settled).toBe(true);
    expect(s.preparation.progression.level).toBe(2);
    const currency = s.preparation.currency;
    expect(s.nextStage()).toBeNull();
    expect(s.preparation.stageId).toBe(2);
    expect(s.preparation.offers).toHaveLength(3);
    expect(
      s.preparation.offers.every((o) => !o.claimed && !offers.some((old) => old.id === o.id)),
    ).toBe(true);
    expect(s.totalHealth()).toBe(
      s.preparation.units.reduce((n, u) => n + maxHeroHp(u, s.preparation.progression), 0),
    );
    expect(s.nextStage()).toBeTruthy();
    expect(s.preparation.currency).toBe(currency);
    s.start();
    const checkpoint = clone(s.preparation);
    while (!s.hasChoices && s.phase === 'combat') s.tick();
    if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
    s.backToPreparation();
    expect(s.preparation).toEqual(checkpoint);
  });
  it('跨关刷新覆盖未领取招募且不扣钱，恢复整备后不重复刷新', () => {
    const s = tutorial();
    expect(s.refresh()).toBeNull();
    const oldOffers = clone(s.preparation.offers);
    s.start();
    finish(s);
    const previous = clone(s.preparation);
    expect(s.preparation.offers).toEqual(oldOffers);
    expect(s.nextStage()).toBeNull();
    const next = clone(s.preparation);
    expect(next.currency).toBe(previous.currency);
    expect(next.units).toEqual(previous.units);
    expect(next.unlocked).toEqual(previous.unlocked);
    expect(next.progression).toEqual(previous.progression);
    expect(next.rng).not.toBe(previous.rng);
    expect(next.offers.every((o) => !o.claimed && !oldOffers.some((old) => old.id === o.id))).toBe(
      true,
    );
    const restored = Session.restore(s.exportSave());
    expect(restored.nextStage()).toBeTruthy();
    expect(restored.preparation).toEqual(next);
    expect(restored.canUndo).toBe(false);
  });
  it('相同逻辑输入在1×/2×的成长与随机结果一致', () => {
    const a = tutorial();
    const b = tutorial();
    a.start();
    b.start();
    b.speed = 2;
    const ca = new GameClock(a);
    const cb = new GameClock(b);
    for (let t = 0; t < 200000; t += 50) {
      if (a.hasChoices) a.chooseBuff(a.battle!.choices[0]);
      if (b.hasChoices) b.chooseBuff(b.battle!.choices[0]);
      ca.advance(t);
      cb.advance(t);
      if (a.phase !== 'combat' && b.phase !== 'combat' && !a.hasChoices && !b.hasChoices) break;
    }
    expect(a.battle).toEqual(b.battle);
    expect(a.preparation).toEqual(b.preparation);
    expect(bonus(a.preparation.progression, 'attack')).toBeGreaterThanOrEqual(0);
  });
});
