import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { battleInspection } from './battle-inspection';

function battle() {
  return createCombat([
    { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
    { id: 11, kind: 'ember_mouse', rank: 2, position: { x: 2, y: 3 } },
    { id: 12, kind: 'shield_fox', rank: 1, position: { x: 3, y: 4 } },
  ]);
}

describe('暂停战场详情只读投影', () => {
  it('真实战斗锁定、护盾吸收和单兽承伤与原始累计一致，观察不写Session/RNG', () => {
    const session = new Session();
    session.preparation.units = [
      { id: 5, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 6, kind: 'shield_fox', rank: 6, position: { x: 2, y: 4 } },
    ];
    session.start();
    for (let i = 0; i < 1000 && session.phase === 'combat'; i++) {
      if (session.hasChoices) session.chooseBuff(session.battle!.choices[0]);
      else session.tick();
      if (session.battle!.report!.units.some((unit) => unit.shieldAbsorbed > 0)) break;
    }
    session.pause(true);
    const before = JSON.stringify(session);
    const view = battleInspection(session.battle, session.preparation.units)!;
    expect(view.allies.some((unit) => unit.stats!.shieldGiven > 0)).toBe(true);
    expect(view.allies.some((unit) => unit.stats!.shieldAbsorbed > 0)).toBe(true);
    for (const unit of view.allies) {
      const record = session.battle!.report!.units.find((entry) => entry.id === unit.id)!;
      expect(unit.stats).toMatchObject({
        damageDone: record.damageDone,
        damageTaken: record.damageTaken,
        shieldAbsorbed: record.shieldAbsorbed,
      });
    }
    session.tick();
    expect(battleInspection(session.battle, session.preparation.units)).toEqual(view);
    expect(JSON.stringify(session)).toBe(before);
  });

  it('同种不同实例按ID匹配，存活者中默认选锁定最多者，死亡敌人和目标不计', () => {
    const b = battle();
    spawnEnemy(b, 'wolf', { x: 1, y: 0 }).target = 10;
    spawnEnemy(b, 'wolf', { x: 2, y: 0 }).target = 11;
    spawnEnemy(b, 'wolf', { x: 3, y: 0 }).target = 11;
    const dead = spawnEnemy(b, 'wolf', { x: 4, y: 0 });
    dead.target = 10;
    dead.hp = 0;
    b.report!.units.reverse();
    b.report!.units.find((entry) => entry.id === 11)!.damageTaken = 23.5;
    const view = battleInspection(b, [])!;
    expect(view.enemyCount).toBe(3);
    expect(view.initialId).toBe(11);
    expect(view.allies.map((unit) => unit.targetedBy)).toEqual([1, 2, 0]);
    expect(view.allies[1].stats!.damageTaken).toBe(23.5);
    b.allies[1].hp = 0;
    const fallen = battleInspection(b, [])!;
    expect(fallen.initialId).toBe(10);
    expect(fallen.aliveCount).toBe(2);
    expect(fallen.allies[1].targetedBy).toBe(0);
  });

  it('过期、零盾和倒下者的旧盾均不显示，有效盾秒数按战斗时钟向上取整', () => {
    const b = battle();
    b.time = 1000;
    Object.assign(b.allies[0], { shield: 20.2, shieldExpires: 2001, hp: 12.2 });
    const inspect = () => battleInspection(b, [])!.allies[0];
    expect(inspect()).toMatchObject({ shield: 21, shieldSeconds: 2, hp: 13 });
    b.allies[0].shieldExpires = 1000;
    expect(inspect()).toMatchObject({ shield: 0, shieldSeconds: 0 });
    b.allies[0].shieldExpires = 3000;
    b.allies[0].shield = 0;
    expect(inspect().shieldSeconds).toBe(0);
    b.allies[0].shield = 30;
    b.allies[0].hp = -1;
    expect(inspect()).toMatchObject({ alive: false, hp: 0, shield: 0, shieldSeconds: 0 });
  });

  it('旧战报缺失及缺实例保持未记录，真实零值与缺值可区分', () => {
    const b = battle();
    b.report!.units = b.report!.units.filter((entry) => entry.id !== 11);
    expect(battleInspection(b, [])!.allies[0].stats!.damageDone).toBe(0);
    expect(battleInspection(b, [])!.allies[1].stats).toBeNull();
    b.report = undefined;
    expect(battleInspection(b, [])!.allies.every((unit) => unit.stats === null)).toBe(true);
  });

  it('稳定按行列排序，保持多格锚点，备战席仅列持有信息，返回数据不共享可写位置', () => {
    const b = battle();
    b.allies.reverse();
    const before = clone(b);
    const view = battleInspection(b, [
      ...b.allies,
      { id: 99, kind: 'boar', rank: 3, position: null },
    ])!;
    expect(view.allies.map((unit) => unit.id)).toEqual([10, 11, 12]);
    expect(view.allies[2].position).toEqual({ x: 3, y: 4 });
    expect(view.reserves).toEqual([{ id: 99, kind: 'boar', rank: 3 }]);
    view.allies[0].position.x = 5;
    view.allies[0].stats!.damageDone = 999;
    expect(b).toEqual(before);
  });

  it('继续后重新读取当前战况，不缓存上一轮数据，空战斗安全', () => {
    expect(battleInspection(null, [])).toBeNull();
    const b = battle();
    const before = battleInspection(b, [])!;
    stepCombat(b);
    expect(battleInspection(b, [])!.time).toBeGreaterThan(before.time);
    b.allies.forEach((unit) => {
      unit.hp = 0;
    });
    expect(battleInspection(b, [])!.initialId).toBe(10);
    b.allies = [];
    expect(battleInspection(b, [])).toMatchObject({ allies: [], initialId: undefined });
  });
});
