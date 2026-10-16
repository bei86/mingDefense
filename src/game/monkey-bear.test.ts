import { describe, expect, it } from 'vitest';
import { clone, heroIds, heroes, cells, type HeroId, type Point } from './content';
import { createCombat, stepCombat, type Combat } from './combat';
import { spawnEnemy } from './combat-skills';
import { eligibleBuffs, initialProgression } from './progression';
import { Session } from './session';
import { validSave } from './persistence';
import type { Unit } from './model';
import { rosterPlaytest } from './fixtures/roster-playtest';

const monkey = 'piercing_monkey';
const bear = 'scatter_bear';
function unit(kind: HeroId, rank = 1, id = 1): Unit {
  return { id, kind, rank, position: { x: 1, y: 3 } };
}
function arena(kind: HeroId, rank = 1, extra: Unit[] = []): Combat {
  const s = createCombat([unit(kind, rank), ...extra]);
  s.spawns = [{ at: 100000, x: 0 }];
  for (const ally of s.allies) ally.cooldown = 100000;
  return s;
}
function enemy(s: Combat, point: Point, hp = 10000) {
  const e = spawnEnemy(s, 'wolf', point);
  e.hp = e.maxHp = hp;
  e.frozenUntil = 100000;
  return e;
}
function hit(s: Combat, target: number, source = 1): void {
  s.attacks = [{ team: 'ally', source, target, ordinal: 1, due: s.time }];
  stepCombat(s);
}

describe('八灵培养与招募', () => {
  it('开发固定阵容合法并可开战，作为视觉验收不冒充经济路线', () => {
    const s = rosterPlaytest();
    expect(validSave(s.exportSave())).toBe(true);
    expect(s.preparation.units.map((u) => u.kind).sort()).toEqual([...heroIds].sort());
    expect(s.start()).toBeNull();
    expect(s.battle!.allies).toHaveLength(8);
  });
  it('猴熊进入正常商店且八灵六阶与占格完整', () => {
    expect(heroIds).toHaveLength(8);
    expect(cells(monkey, { x: 1, y: 3 })).toEqual([
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
    expect(cells(bear, { x: 1, y: 3 })).toEqual([
      { x: 1, y: 3 },
      { x: 1, y: 4 },
    ]);
    for (const kind of [monkey, bear] as const) {
      expect(heroes[kind].hp).toHaveLength(6);
      expect(heroes[kind].hitDamage).toHaveLength(6);
    }
    const seen = new Set<string>();
    for (let seed = 20261014; seed < 20261214; seed++) {
      const s = new Session(seed);
      expect(s.refresh(true)).toBeNull();
      for (const offer of s.preparation.offers) if (offer.kind !== 'cell') seen.add(offer.kind);
    }
    expect([...seen].sort()).toEqual([...heroIds].sort());
    expect(new Session(1, 'm1').heroPool).toHaveLength(3);
  });
  it.each([monkey, bear] as const)('%s部署失败原子回滚，能合成到六阶并往返存档', (kind) => {
    const s = new Session();
    s.preparation.offers = [1, 2, 3].map((id) => ({ id, kind, claimed: false }));
    const before = clone(s.preparation);
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 5, y: 5 })).toBeTruthy();
    expect(s.preparation).toEqual(before);
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
    const target = s.preparation.units[0];
    for (let rank = 1; rank < 6; rank++) {
      const id = s.preparation.nextId++;
      s.preparation.units.push({ id, kind, rank, position: null });
      expect(s.transfer({ type: 'unit', id }, { merge: target.id })).toBeNull();
    }
    expect(s.preparation.units[0]).toMatchObject({ rank: 6, position: { x: 1, y: 3 } });
    const id = s.preparation.nextId++;
    s.preparation.units.push({ id, kind, rank: 6, position: null });
    expect(s.transfer({ type: 'unit', id }, { merge: target.id })).toBeTruthy();
    const save = s.exportSave();
    expect(validSave(save)).toBe(true);
    expect(Session.restore(save).preparation).toEqual(s.preparation);
  });
  it('专属天赋按上阵、三阶和上限过滤，备战不触发', () => {
    const p = initialProgression(1);
    const units = [unit(monkey, 2), { ...unit(bear, 3, 2), position: null }];
    const buff = 'monkey_vulnerability';
    expect(eligibleBuffs(p, units, 1)).not.toContain(buff);
    expect(eligibleBuffs(p, units, 1)).not.toContain('bear_attack');
    units[0].rank = 3;
    units[1].position = { x: 4, y: 3 };
    expect(eligibleBuffs(p, units, 1)).toEqual(expect.arrayContaining([buff, 'bear_attack']));
    p.buffs[buff] = 3;
    p.buffs.bear_attack = 3;
    expect(eligibleBuffs(p, units, 1)).not.toContain(buff);
    expect(eligibleBuffs(p, units, 1)).not.toContain('bear_attack');
  });
});

describe('穿林猿贯穿与易伤', () => {
  it('一阶不施加易伤，射程端点和宽度边界均可命中', () => {
    const s = arena(monkey);
    const target = enemy(s, { x: 2.5, y: 1.5 });
    const edge = enemy(s, { x: 3, y: -1.5 });
    const outside = enemy(s, { x: 3.001, y: -1.5 });
    hit(s, target.id);
    expect(edge.hp).toBe(9900);
    expect(outside.hp).toBe(10000);
    expect(target.vulnerabilityUntil).toBeUndefined();
  });
  it('已有易伤作用于剑阵和鳄鱼减伤，先相乘再统一取整', () => {
    const s = arena(monkey, 3);
    const e = spawnEnemy(s, 'croc', { x: 2.5, y: 1.5 });
    e.hp = e.maxHp = 10000;
    e.frozenUntil = 100000;
    hit(s, e.id);
    expect(e.hp).toBe(9771); // floor(270 × 85%) = 229
    s.fields.push({ id: 1, born: s.time - 1000, damage: 101, hits: 0, x: e.x, y: e.y, source: 1 });
    stepCombat(s);
    expect(e.hp).toBe(9677); // floor(101 × 110% × 85%) = 94
    expect(s.damageDone).toBe(323);
    expect(s.report!.units[0].damageDone).toBe(323);
  });
  it('贯穿射程内直线敌人，排除侧面、身后和射程外', () => {
    const s = arena(monkey);
    const a = enemy(s, { x: 2.5, y: 1.5 });
    const b = enemy(s, { x: 2.5, y: 0.5 });
    const side = enemy(s, { x: 3.5, y: 0.5 });
    const behind = enemy(s, { x: 2.5, y: 4.5 });
    const far = enemy(s, { x: 2.5, y: -2.5 });
    hit(s, a.id);
    expect([a.hp, b.hp, side.hp, behind.hp, far.hp]).toEqual([9900, 9900, 10000, 10000, 10000]);
    expect(s.report!.units[0].damageDone).toBe(200);
  });
  it('三阶首击不吃新易伤，同帧其他攻击也不受事件顺序影响', () => {
    for (const reverse of [false, true]) {
      const monkeyId = reverse ? 2 : 1;
      const mouseId = reverse ? 1 : 2;
      const s = arena(monkey, 3, [unit('ember_mouse', 1, mouseId)]);
      s.allies[0].id = monkeyId;
      s.report!.units[0].id = monkeyId;
      const e = enemy(s, { x: 2.5, y: 1.5 });
      s.attacks = [1, 2].map((source) => ({
        team: 'ally',
        source,
        target: e.id,
        ordinal: 1,
        due: 0,
      }));
      if (reverse) s.attacks.reverse();
      stepCombat(s);
      expect(e.hp).toBe(9670);
      hit(s, e.id, mouseId);
      expect(e.hp).toBe(9604);
      s.time = 3000;
      hit(s, e.id, mouseId);
      expect(e.hp).toBe(9544);
    }
  });
  it('破势增加易伤百分点，多猴刷新取最大值，过期后可重新施加', () => {
    const s = arena(monkey, 3, [unit(monkey, 3, 2), unit('ember_mouse', 1, 3)]);
    const e = enemy(s, { x: 2.5, y: 1.5 });
    s.progression.buffs.monkey_vulnerability = 3;
    hit(s, e.id);
    s.progression.buffs.monkey_vulnerability = 0;
    hit(s, e.id, 2);
    const hp = e.hp;
    hit(s, e.id, 3);
    expect(hp - e.hp).toBe(75);
    s.time = 3050;
    hit(s, e.id, 2);
    const nextHp = e.hp;
    hit(s, e.id, 3);
    expect(nextHp - e.hp).toBe(66);
  });
  it('五阶第二段保持方向，首目标与施法者死亡后仍命中并归属原实例', () => {
    const s = arena(monkey, 5, [unit('fortune_peach', 1, 2)]);
    const a = enemy(s, { x: 2.5, y: 1.5 }, 420);
    const b = enemy(s, { x: 2.5, y: 0.5 });
    hit(s, a.id);
    expect(a.hp).toBe(0);
    expect(b.hp).toBe(9580);
    s.allies[0].hp = 0;
    stepCombat(s);
    stepCombat(s);
    expect(b.hp).toBe(9118); // 第二段420，已有10%易伤，未重复乘双段倍率。
    expect(s.report!.units[0].damageDone).toBe(1302);
    expect(s.damageDone).toBe(1302);
  });
  it('前摇死亡取消贯穿与第二段', () => {
    const s = arena(monkey, 5, [unit('fortune_peach', 1, 2)]);
    const e = enemy(s, { x: 2.5, y: 1.5 });
    s.allies[0].hp = 0;
    hit(s, e.id);
    expect(e.hp).toBe(10000);
    expect(s.released).toHaveLength(0);
  });
});

describe('磐拳熊散射与分裂', () => {
  it('近距离同目标吃三弹，远距离只中正中弹', () => {
    const near = arena(bear);
    const a = enemy(near, { x: 1.5, y: 3.3 });
    hit(near, a.id);
    expect(a.hp).toBe(9760);
    const far = arena(bear);
    const b = enemy(far, { x: 1.5, y: 0 });
    hit(far, b.id);
    expect(b.hp).toBe(9920);
  });
  it('每条拳罡只打第一个阻挡者，输入数组顺序不改变结果', () => {
    for (const reverse of [false, true]) {
      const s = arena(bear);
      const target = enemy(s, { x: 1.5, y: 1 });
      const blocker = enemy(s, { x: 1.5, y: 3 });
      if (reverse) s.enemies.reverse();
      hit(s, target.id);
      expect(target.hp).toBe(10000);
      expect(blocker.hp).toBe(9760);
    }
  });
  it('三阶分裂各命中一次，不回打父目标、不递归；零距离瞄准有效', () => {
    const s = arena(bear, 3);
    const a = enemy(s, { x: 1.5, y: 4 });
    const left = enemy(s, { x: 0.9, y: 2.9 });
    const right = enemy(s, { x: 2.1, y: 2.9 });
    const chained = enemy(s, { x: 0.3, y: 1.8 });
    hit(s, a.id);
    expect(a.hp).toBe(9370);
    expect(left.hp).toBe(9781);
    expect(right.hp).toBe(9781);
    expect(chained.hp).toBe(10000);
    expect(s.report!.units[0].damageDone).toBe(1068);
    expect(s.damageDone).toBe(1068);
  });
  it('通用和拳意加成相加，三弹过量伤害仅记录实际生命损失', () => {
    const s = arena(bear);
    s.progression.buffs.attack = 1;
    s.progression.buffs.bear_attack = 1;
    const a = enemy(s, { x: 1.5, y: 3.3 }, 200);
    hit(s, a.id);
    expect(a.hp).toBe(0);
    expect(s.report!.units[0].damageDone).toBe(200);
    const b = enemy(s, { x: 1.5, y: 3.3 });
    hit(s, b.id);
    expect(b.hp).toBe(9712);
  });
});
