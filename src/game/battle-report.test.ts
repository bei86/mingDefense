import { describe, expect, it } from 'vitest';
import { clone, config } from './content';
import { createCombat, stepCombat, type Combat } from './combat';
import { spawnEnemy } from './combat-skills';
import { Session } from './session';
import type { Unit } from './model';

function unit(id: number, kind: Unit['kind'], rank = 1): Unit {
  return { id, kind, rank, position: { x: id, y: 3 } };
}
function arena(units = [unit(1, 'ember_mouse')]): Combat {
  const s = createCombat(units);
  s.spawns = [{ at: 100000, x: 0 }];
  s.allies.forEach((u) => (u.cooldown = 100000));
  return s;
}
function enemy(s: Combat, hp = 10000, kind: 'wolf' | 'croc' = 'wolf') {
  const e = spawnEnemy(s, kind, { x: 1.5, y: 3.5 });
  e.hp = hp;
  e.maxHp = hp;
  e.cooldown = 100000;
  return e;
}

describe('逐兽战报', () => {
  it('同种不同实例分别统计，过量伤害只计实际扣血且不统计备战', () => {
    const s = arena([
      unit(1, 'ember_mouse'),
      unit(2, 'ember_mouse'),
      { ...unit(3, 'fortune_peach'), position: null },
    ]);
    const e = enemy(s, 80);
    s.attacks = [1, 2].map((source) => ({
      team: 'ally',
      source,
      target: e.id,
      ordinal: 1,
      due: 0,
    }));
    stepCombat(s);
    expect(s.report!.units.map((u) => u.damageDone)).toEqual([60, 20]);
    expect(s.damageDone).toBe(80);
    expect(s.report!.units.map((u) => u.id)).toEqual([1, 2]);
  });
  it('猪范围主击与鳄减伤均归属释放者，逐兽合计等于总伤害', () => {
    const s = arena([unit(1, 'boar', 3)]);
    const e = enemy(s, 10000, 'croc');
    enemy(s);
    s.attacks = [{ team: 'ally', source: 1, target: e.id, ordinal: 3, due: 0 }];
    stepCombat(s);
    expect(s.report!.units[0].damageDone).toBe(
      Math.floor(486 * 0.85) + Math.floor(270 * 0.85) + 270,
    );
    expect(s.report!.units[0].damageDone).toBe(s.damageDone);
  });
  it('双鹰死后剑阵和延迟双段仍归属原实例', () => {
    const s = arena([unit(1, 'sword_eagle', 5), unit(2, 'sword_eagle', 5), unit(3, 'ember_mouse')]);
    const e = enemy(s, 100000);
    s.attacks = [1, 2].map((source) => ({
      team: 'ally',
      source,
      target: e.id,
      ordinal: 1,
      due: 0,
    }));
    stepCombat(s);
    s.allies[0].hp = 0;
    s.allies[1].hp = 0;
    for (let i = 0; i < 40; i++) stepCombat(s);
    expect(s.report!.units.map((u) => u.damageDone)).toEqual([1420, 1420, 0]);
    expect(s.damageDone).toBe(2840);
  });
  it('护盾只计实际新增量，吸收与生命损失分开且不计过量承伤', () => {
    const s = arena([unit(1, 'shield_fox'), unit(2, 'ember_mouse')]);
    const target = s.allies[1];
    target.shield = 35;
    target.shieldExpires = 10000;
    s.attacks = [{ team: 'ally', source: 1, target: 2, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(target.shield).toBe(36);
    expect(s.report!.units[0].shieldGiven).toBe(1);
    s.attacks = [{ team: 'ally', source: 1, target: 2, ordinal: 2, due: s.time }];
    stepCombat(s);
    expect(s.report!.units[0].shieldGiven).toBe(1);
    const e = enemy(s);
    target.hp = 3;
    s.attacks = Array.from({ length: 4 }, () => ({
      team: 'enemy' as const,
      source: e.id,
      target: 2,
      ordinal: 0,
      due: s.time,
    }));
    stepCombat(s);
    expect(s.report!.units[1]).toMatchObject({ damageTaken: 3, shieldAbsorbed: 36 });
    expect(s.damageTaken).toBe(3);
  });
  it('桃独立产钱，重伤停止；聚灵仅记录实际生效时间', () => {
    const s = arena([unit(1, 'fortune_peach'), unit(2, 'fortune_peach'), unit(3, 'ember_mouse')]);
    s.time = 20000;
    s.energy = 1;
    stepCombat(s, true);
    s.allies[0].hp = 0;
    s.time = 40000;
    stepCombat(s, true);
    expect(s.report!.units.map((u) => u.income)).toEqual([1, 2, 0]);
    expect(s.income).toBe(3);
    expect(s.report!.boostedMs).toBe(config.runtime.tickMs);
  });
  it('同tick互杀仍判负，双方实际损失均记录', () => {
    const s = arena();
    const e = enemy(s, 5);
    s.allies[0].hp = 5;
    s.attacks = [
      { team: 'ally', source: 1, target: e.id, ordinal: 1, due: 0 },
      { team: 'enemy', source: e.id, target: 1, ordinal: 0, due: 0 },
    ];
    stepCombat(s);
    expect(s.result).toBe('defeat');
    expect(s.report!.units[0]).toMatchObject({ damageDone: 5, damageTaken: 5 });
  });
  it('统计不改变模拟结果或随机数；重试时清零', () => {
    const a = arena([unit(1, 'boar', 3)]);
    enemy(a);
    a.allies[0].cooldown = 0;
    const b = clone(a);
    delete b.report;
    for (let i = 0; i < 400; i++) {
      stepCombat(a, true);
      stepCombat(b, true);
    }
    const withoutReport = clone(a);
    delete withoutReport.report;
    expect(withoutReport).toEqual(b);
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.start();
    for (let i = 0; i < 250; i++) s.tick();
    expect(s.battle!.damageDone).toBeGreaterThan(0);
    expect(s.retry()).toBeNull();
    expect(s.battle!.report!.units[0]).toMatchObject({ damageDone: 0, damageTaken: 0, income: 0 });
    expect(s.battle!.report!.boostedMs).toBe(0);
  });
});
