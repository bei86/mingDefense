import { describe, expect, it } from 'vitest';
import { clone, config, heroes } from './content';
import {
  createCombat,
  enemyTarget,
  stepCombat,
  waveSpawns,
  type Combat,
  type Enemy,
} from './combat';
import { GameClock } from './clock';
import { Session, type Unit } from './session';

function deployed(): Session {
  const s = new Session(20261014, 'm1');
  expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  const mouse = s.preparation.units[0];
  expect(s.transfer({ type: 'offer', id: 2 }, { merge: mouse.id })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 })).toBeNull();
  return s;
}
const enemy = (id: number, x = 1.5, y = 3.5, hp = 220): Enemy => ({
  id,
  x,
  y,
  hp,
  cooldown: 10000,
  target: null,
  recheckAt: 0,
});
const unit = (kind: Unit['kind'], rank = 1): Unit => ({
  id: 10,
  kind,
  rank,
  position: { x: 1, y: 3 },
});
function isolated(u = unit('ember_mouse')): Combat {
  const s = createCombat([u]);
  s.spawns = [{ at: 100000, x: 1.5 }];
  s.enemies = [enemy(1)];
  s.allies[0].cooldown = 100000;
  return s;
}
function finish(s: Session) {
  for (let i = 0; i < 4000 && s.phase === 'combat'; i++) s.tick();
  return s.battle!;
}

describe('准备期命令与经济', () => {
  it('非法占地原子回滚，保留招募、货币及 RNG', () => {
    const s = new Session(20261014, 'm1');
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'offer', id: 4 }, { x: 4, y: 5 })).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
  it('普通部署不能覆盖现有占地或隐式换位、旋转', () => {
    const s = new Session(20261014, 'm1');
    s.transfer({ type: 'offer', id: 3 }, { x: 1, y: 3 });
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 2, y: 3 })).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
  it('两位备战席按单位计数，满席仍可直接领取合成', () => {
    const s = new Session(20261014, 'm1');
    s.transfer({ type: 'offer', id: 1 }, 'reserve');
    s.transfer({ type: 'offer', id: 3 }, 'reserve');
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'offer', id: 4 }, 'reserve')).toBeTruthy();
    expect(s.preparation).toEqual(before);
    const target = s.preparation.units[0];
    expect(s.transfer({ type: 'offer', id: 2 }, { merge: target.id })).toBeNull();
    expect(s.preparation.units.length).toBe(2);
    expect(s.preparation.units[0].rank).toBe(2);
  });
  it('合成保留目标 ID/位置并禁止超出三阶', () => {
    const s = deployed();
    const target = s.preparation.units[0];
    const position = clone(target.position);
    s.preparation.units.push({ id: 90, kind: target.kind, rank: 2, position: null });
    s.transfer({ type: 'unit', id: 90 }, { merge: target.id });
    expect(s.preparation.units[0]).toMatchObject({ id: target.id, rank: 3, position });
    s.preparation.units.push({ id: 91, kind: target.kind, rank: 3, position: null });
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'unit', id: 91 }, { merge: target.id })).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
  it('只撤销一次布阵，可恢复合成所消耗的招募', () => {
    const s = new Session(20261014, 'm1');
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    const before = clone(s.preparation);
    s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id });
    s.undo();
    expect(s.preparation).toEqual(before);
    expect(s.undo()).toBeTruthy();
  });
  it('刷新确认、费用、种子一致性；无法通过撤销免费重抽', () => {
    const a = new Session(7, 'm1');
    const b = new Session(7, 'm1');
    const before = clone(a.preparation);
    expect(a.refresh()).toBeTruthy();
    expect(a.preparation).toEqual(before);
    expect(a.refresh(true)).toBeNull();
    b.refresh(true);
    expect(a.preparation).toEqual(b.preparation);
    expect(a.preparation.currency).toBe(30);
    expect(a.preparation.offers.length).toBe(3);
    expect(a.undo()).toBeTruthy();
    a.refresh(true);
    a.refresh(true);
    const empty = clone(a.preparation);
    expect(a.refresh(true)).toBeTruthy();
    expect(a.preparation).toEqual(empty);
  });
  it('扩地只允许相邻锁定格，失败不消耗令牌，撤销还原', () => {
    const s = new Session(20261014, 'm1');
    s.preparation.offers = [{ id: 99, kind: 'cell', claimed: false }];
    const before = clone(s.preparation);
    expect(s.expand(99, { x: 0, y: 0 })).toBeTruthy();
    expect(s.preparation).toEqual(before);
    expect(s.expand(99, { x: 0, y: 3 })).toBeNull();
    expect(s.preparation.unlocked).toHaveLength(13);
    s.undo();
    expect(s.preparation).toEqual(before);
  });
  it('不能空阵出战，战斗期间禁止修改准备状态', () => {
    const s = new Session(20261014, 'm1');
    expect(s.start()).toBeTruthy();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.start();
    const before = clone(s.preparation);
    expect(s.refresh(true)).toBeTruthy();
    expect(s.preparation).toEqual(before);
  });
});

describe('独立战斗模拟', () => {
  it('教程三英雄阵容可击退完整 18 敌，波次间不提前胜利', () => {
    const s = deployed();
    s.start();
    for (let i = 0; i < 120; i++) s.tick();
    expect(s.phase).toBe('combat');
    expect(s.battle!.spawnIndex).toBe(6);
    const result = finish(s);
    expect(result.result).toBe('victory');
    expect(result.kills).toBe(18);
    expect(result.time).toBeGreaterThan(17000);
    expect(s.totalHealth()).toBeGreaterThan(0);
    expect(s.preparation.currency).toBe(70);
  });
  it.each(config.stages.map((stage) => stage.id))(
    '第%s关从开场连续出怪，不在波次间等待',
    (stageId) => {
      const spawns = waveSpawns(stageId).filter((spawn) => spawn.kind !== 'boss');
      const stage = config.stages[stageId - 1];
      const expectedCount = stage.waves.reduce(
        (total, wave) =>
          total + Object.values(wave.enemies).reduce((n, count) => n + (count ?? 0), 0),
        0,
      );
      expect(spawns).toHaveLength(expectedCount);
      expect(spawns.map((spawn) => spawn.at)).toEqual(
        Array.from({ length: expectedCount }, (_, i) => i * config.waves.spawnIntervalMs),
      );
    },
  );
  it('同一阵容/输入在 1× 和 2× 得到完全一致的最终状态', () => {
    const a = deployed();
    const b = deployed();
    a.start();
    b.start();
    b.speed = 2;
    const ca = new GameClock(a);
    const cb = new GameClock(b);
    for (let t = 0; t < 200000 && (a.phase === 'combat' || b.phase === 'combat'); t += 50) {
      ca.advance(t);
      cb.advance(t);
    }
    expect(a.battle).toEqual(b.battle);
    expect(a.preparation).toEqual(b.preparation);
  });
  it('同排先低阶，同阶鼠仇恨高于豚，距离不覆盖等级和类型', () => {
    const a = createCombat([
      unit('ember_mouse'),
      { id: 11, kind: 'boar', rank: 1, position: { x: 2, y: 3 } },
    ]).allies;
    expect(enemyTarget(a, { x: 1.5, y: 3.5 })!.kind).toBe('ember_mouse');
    a[0].rank = 2;
    expect(enemyTarget(a, { x: 1.5, y: 3.5 })!.kind).toBe('boar');
    expect(enemyTarget(a, { x: 5.5, y: -0.5 })!.kind).toBe('boar');
  });
  it('前摇内死亡取消攻击，死目标不会重新选定', () => {
    const s = isolated();
    s.attacks = [{ source: 10, target: 1, team: 'ally', due: 100, ordinal: 1 }];
    s.allies[0].hp = 0;
    stepCombat(s);
    expect(s.attacks).toHaveLength(0);
    expect(s.enemies[0].hp).toBe(220);
    const b = isolated();
    b.enemies.push(enemy(2));
    b.attacks = [{ source: 10, target: 99, team: 'ally', due: 0, ordinal: 1 }];
    stepCombat(b);
    expect(b.enemies.map((e) => e.hp)).toEqual([220, 220]);
  });
  it('猪三阶第三击为主击 486 + 范围 270，不重复乘 120%', () => {
    const s = isolated(unit('boar', 3));
    s.enemies = [enemy(1, 1.5, 3.5, 2000), enemy(2, 2, 3.5, 2000), enemy(3, 4, 3.5, 2000)];
    s.attacks = [{ source: 10, target: 1, team: 'ally', due: 0, ordinal: 3 }];
    stepCombat(s);
    expect(s.enemies.map((e) => e.hp)).toEqual([1244, 1730, 2000]);
  });
  it('鹰三阶范围伤害 270、剑阵每次 floor(270×48%)，施法者死后剑阵继续', () => {
    const s = isolated(unit('sword_eagle', 3));
    s.enemies = [enemy(1, 1.5, 3.5, 2000)];
    s.attacks = [{ source: 10, target: 1, team: 'ally', due: 0, ordinal: 1 }];
    stepCombat(s);
    expect(s.enemies[0].hp).toBe(1730);
    expect(s.fields).toHaveLength(1);
    s.allies[0].hp = 0;
    // Another living ally keeps the battle alive while the dead caster's field ticks.
    const survivor = createCombat([{ ...unit('ember_mouse'), id: 20 }]).allies[0];
    survivor.cooldown = 100000;
    s.allies.push(survivor);
    for (let i = 0; i < 40; i++) stepCombat(s);
    expect(s.enemies[0].hp).toBe(1472);
    expect(s.fields).toHaveLength(0);
  });
  it('独立剑阵叠加', () => {
    const s = isolated();
    s.fields = [1, 2].map((id) => ({ id, x: 1.5, y: 3.5, born: -1000, damage: 129.6, hits: 0 }));
    s.enemies[0].hp = 2000;
    stepCombat(s);
    expect(s.enemies[0].hp).toBe(1742);
  });
  it('同 tick 相互击杀判负；限时同 tick 清场且有存活英雄判胜', () => {
    const s = isolated();
    s.spawns = [];
    s.allies[0].hp = 14;
    s.enemies[0].hp = 60;
    s.attacks = [
      { team: 'ally', source: 10, target: 1, due: 0, ordinal: 1 },
      { team: 'enemy', source: 1, target: 10, due: 0, ordinal: 1 },
    ];
    stepCombat(s);
    expect(s.kills).toBe(1);
    expect(s.result).toBe('defeat');
    const b = isolated();
    b.spawns = [];
    b.time = config.runtime.stageLimitMs - 50;
    b.enemies[0].hp = 60;
    b.attacks = [{ team: 'ally', source: 10, target: 1, due: b.time, ordinal: 1 }];
    stepCombat(b);
    expect(b.result).toBe('victory');
  });
  it('聚灵每 tick 消耗 1，空灵气不生效、击杀 +5、上限100', () => {
    const s = isolated();
    s.energy = 1;
    stepCombat(s, true);
    expect(s.energy).toBe(0);
    expect(s.boosted).toBe(true);
    stepCombat(s, true);
    expect(s.boosted).toBe(false);
    s.energy = 99;
    s.enemies[0].hp = 1;
    s.attacks = [{ team: 'ally', source: 10, target: 1, due: s.time, ordinal: 1 }];
    stepCombat(s);
    expect(s.energy).toBe(100);
  });
  it('持续聚灵仅加快英雄动作，时间/敌人/剑阵时钟不加速', () => {
    const s = isolated();
    s.allies[0].cooldown = 0;
    s.energy = 100;
    s.enemies[0].hp = 10000;
    for (let i = 0; i < 15; i++) stepCombat(s, true);
    expect(s.allies[0].ordinal).toBe(2);
    expect(s.time).toBe(750);
    expect(s.energy).toBe(85);
  });
  it('聚灵在行动开始时换算间隔与前摇，向上取整到50ms', () => {
    const s = isolated(unit('boar'));
    s.allies[0].cooldown = 0;
    s.energy = 10;
    stepCombat(s, true);
    expect(s.allies[0].cooldown).toBe(900);
    expect(s.attacks.find((a) => a.team === 'ally')!.due).toBe(150);
    stepCombat(s, false);
    expect(s.allies[0].cooldown).toBe(850);
    expect(s.boosted).toBe(false);
  });
  it('范围按占地中心计算，敌人接触距离按最近占地格计算', () => {
    const s = createCombat([unit('sword_eagle')]);
    s.spawns = [{ at: 100000, x: 1.5 }];
    s.enemies = [{ ...enemy(1, 2.5, 3.5), cooldown: 0 }];
    stepCombat(s);
    expect(s.enemies[0].x).toBe(2.5);
    expect(s.enemies[0].y).toBe(3.5);
    expect(s.attacks.some((a) => a.team === 'enemy')).toBe(true);
  });
});

describe('检查点及生命周期', () => {
  it('中止恢复整个检查点（货币、RNG、招募、合成和格子）', () => {
    const s = deployed();
    s.refresh(true);
    const checkpoint = clone(s.preparation);
    s.start();
    for (let i = 0; i < 100; i++) s.tick();
    s.backToPreparation();
    expect(s.preparation).toEqual(checkpoint);
    expect(s.battle).toBeNull();
    expect(s.held).toBe(false);
  });
  it('失败免费重试同一输入得到同一结果', () => {
    const s = new Session(20261014, 'm1');
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 5 });
    s.start();
    const first = clone(finish(s));
    expect(first.result).toBe('defeat');
    const money = s.preparation.currency;
    s.retry();
    expect(finish(s)).toEqual(first);
    expect(s.preparation.currency).toBe(money);
  });
  it('通关反复重试只奖励一次，练习中止也不丢已领的奖励', () => {
    const s = deployed();
    s.start();
    finish(s);
    expect(s.preparation.currency).toBe(70);
    expect(s.lastReward).toBe(25);
    s.retry();
    finish(s);
    expect(s.preparation.currency).toBe(70);
    expect(s.lastReward).toBe(0);
    s.retry();
    s.backToPreparation();
    expect(s.preparation.currency).toBe(70);
  });
  it('暂停和大墙钟间隔不会偷偷推进，恢复需重新按住', () => {
    const s = deployed();
    s.start();
    const clock = new GameClock(s);
    clock.advance(0);
    clock.advance(100);
    expect(s.battle!.time).toBe(100);
    s.held = true;
    s.pause(true);
    expect(s.held).toBe(false);
    clock.advance(30000);
    expect(s.battle!.time).toBe(100);
    s.pause(false);
    clock.advance(30100);
    expect(s.battle!.time).toBe(100);
    clock.advance(30150);
    expect(s.battle!.time).toBe(150);
    clock.advance(60000);
    expect(s.battle!.time).toBe(150);
  });
  it('状态和检查点可 JSON 序列化，配置仍为唯一数值源', () => {
    const s = deployed();
    s.start();
    s.tick();
    expect(JSON.parse(JSON.stringify(s.battle))).toEqual(s.battle);
    expect(heroes.boar.hitDamage[2]).toBe(324);
    expect(heroes.ember_mouse.hp.slice(0, 3)).toEqual([120, 204, 288]);
  });
});
