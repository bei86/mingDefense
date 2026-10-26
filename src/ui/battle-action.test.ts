import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { heroRange, spawnEnemy } from '../game/combat-skills';
import { center, clone, config, type HeroId } from '../game/content';
import { battleAction } from './battle-action';
import { BattleAction } from './BattleAction';
import { BattleStats } from './BattleStats';

function setup(kind: HeroId = 'ember_mouse') {
  const b = createCombat([
    { id: 10, kind, rank: 3, position: { x: 0, y: 0 } },
    { id: 11, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 0 } },
    { id: 12, kind: 'ember_mouse', rank: 2, position: null },
  ]);
  b.spawns = [];
  return b;
}

function inRangeEnemy(b: ReturnType<typeof setup>) {
  const p = center(b.allies[0].kind, b.allies[0].position);
  const enemy = spawnEnemy(b, 'wolf', p);
  enemy.hp = enemy.maxHp = 1e8;
  enemy.cooldown = 1e8;
  return enemy;
}

describe('暂停灵兽行动状态', () => {
  it('真实前摇、释放与冷却独立，最后一个tick可立即再次行动', () => {
    const b = setup();
    inRangeEnemy(b);
    stepCombat(b);
    const first = clone(b.attacks.find((a) => a.team === 'ally')!);
    expect(battleAction(b, 10)).toMatchObject({
      cooldownMs: b.allies[0].cooldown - config.runtime.tickMs,
      pending: [{ remainingMs: first.due - b.time, targetAlive: true, ordinal: 1 }],
    });
    while (b.time < first.due) stepCombat(b);
    expect(battleAction(b, 10)!.pending[0].remainingMs).toBe(0);
    stepCombat(b);
    expect(b.damageDone).toBeGreaterThan(0);
    expect(battleAction(b, 10)!.pending).toEqual([]);
    while (b.allies[0].cooldown > config.runtime.tickMs) stepCombat(b);
    expect(battleAction(b, 10)).toMatchObject({
      cooldownMs: 0,
      status: '已就绪 · 恢复后可发起攻击',
    });
    expect(b.allies[0].ordinal).toBe(1);
    stepCombat(b);
    expect(b.allies[0].ordinal).toBe(2);
  });

  it('就绪时按存活敌人与当前真实射程判断等待，聚灵残留不重算已有冷却', () => {
    const b = setup();
    expect(battleAction(b, 10)!.status).toBe('已就绪 · 等待范围内敌人');
    const enemy = inRangeEnemy(b);
    expect(battleAction(b, 10)!.status).toContain('可发起攻击');
    enemy.y = 0.5 - heroRange(b.allies[0], b.progression) - 0.1;
    expect(battleAction(b, 10)!.status).toContain('等待范围内敌人');
    b.progression.buffs.range = 3;
    expect(battleAction(b, 10)!.status).toContain('可发起攻击');
    enemy.hp = 0;
    expect(battleAction(b, 10)!.status).toContain('等待范围内敌人');
    b.allies[0].cooldown = 700;
    const before = battleAction(b, 10);
    b.boosted = true;
    b.progression.buffs.attack_speed = 20;
    expect(battleAction(b, 10)).toEqual(before);
    expect(before!.cooldownMs).toBe(650);
    b.allies[0].cooldown = -500;
    expect(battleAction(b, 10)!.cooldownMs).toBe(0);
  });

  it('狐准备目标按己方实例读取，双方同号不混淆，真实释放增加目标护盾', () => {
    const b = setup('shield_fox');
    const enemy = inRangeEnemy(b);
    enemy.id = 11;
    b.attacks.push({ team: 'ally', source: 10, target: 11, ordinal: 1, due: 0 });
    const action = battleAction(b, 10)!;
    expect(action.status).toBe('已就绪 · 恢复后选择施盾目标');
    expect(action.pending[0]).toMatchObject({ targetLabel: '灵金桃1阶 · #11', targetAlive: true });
    b.allies[0].cooldown = 1000;
    stepCombat(b);
    expect(b.allies[1].shield).toBeGreaterThan(0);
    expect(battleAction(b, 10)!.pending).toEqual([]);
  });

  it('桃只读真实下次产钱，不受攻速冷却影响，到期与真实产钱一致', () => {
    const b = setup('fortune_peach');
    inRangeEnemy(b);
    b.allies[0].cooldown = 9000;
    b.progression.buffs.attack_speed = 20;
    const due = b.allies[0].incomeAt!;
    expect(battleAction(b, 10)).toMatchObject({ cooldownMs: null, incomeMs: due, pending: [] });
    b.time = due - 50;
    expect(battleAction(b, 10)!.incomeMs).toBe(50);
    stepCombat(b);
    expect(b.report!.units[0].income).toBe(0);
    expect(battleAction(b, 10)).toMatchObject({ incomeMs: 0, status: '待产钱' });
    stepCombat(b);
    expect(b.report!.units[0].income).toBe(1);
    expect(battleAction(b, 10)!.incomeMs).toBe(due - 50);
  });

  it('失效目标仍列出待取消动作，按due排序且不混入敌方动作或已发出效果；读取只读', () => {
    const b = setup();
    const enemy = inRangeEnemy(b);
    enemy.id = 11;
    enemy.hp = 0;
    b.time = 100;
    b.attacks = [
      { team: 'ally', source: 10, target: 11, ordinal: 2, due: 500 },
      { team: 'enemy', source: 10, target: 11, ordinal: 1, due: 200 },
      { team: 'ally', source: 10, target: 999, ordinal: 1, due: 50 },
      { team: 'ally', source: 11, target: 11, ordinal: 1, due: 200 },
    ];
    b.released.push({
      shape: 'area',
      source: 10,
      target: 11,
      due: 700,
      kind: 'ember_mouse',
      damage: 5,
      point: { x: 0, y: 0 },
      radius: 1,
    });
    const before = clone(b);
    expect(battleAction(b, 10)!.pending).toEqual([
      { ordinal: 1, targetLabel: '#999', targetAlive: false, remainingMs: 0 },
      { ordinal: 2, targetLabel: '奔雷狼 · #11', targetAlive: false, remainingMs: 400 },
    ]);
    expect(b).toEqual(before);
    b.allies[0].hp = 0;
    expect(battleAction(b, 10)).toEqual({
      alive: false,
      status: '已倒下，本关不再行动',
      cooldownMs: null,
      incomeMs: null,
      pending: [],
    });
    expect(battleAction(null, 10)).toBeNull();
    expect(battleAction(b, 999)).toBeNull();
    expect(battleAction(b, 12)).toBeNull();
  });

  it('SSR区分攻击施盾与桃、待释放与小于0.1秒；属性默认收起且倒下者无倒计时', () => {
    const b = setup();
    const enemy = inRangeEnemy(b);
    b.attacks.push({ team: 'ally', source: 10, target: enemy.id, ordinal: 1, due: 50 });
    const render = () =>
      renderToStaticMarkup(createElement(BattleAction, { battle: b, unitId: 10 }));
    expect(render()).toContain('当前行动状态');
    expect(render()).toContain('准备攻击');
    expect(render()).toContain('剩余 0.1 秒');
    b.time = 50;
    expect(render()).toContain('待释放');
    enemy.hp = 0;
    expect(render()).toContain('目标已倒下或退场，此动作不会生效');
    expect(
      renderToStaticMarkup(createElement(BattleStats, { battle: b, unitId: 10 })),
    ).not.toContain('当前行动状态');
    b.allies[0].kind = 'shield_fox';
    expect(render()).toContain('准备施盾');
    b.allies[0].kind = 'fortune_peach';
    expect(render()).toContain('下次产钱');
    expect(render()).not.toContain('准备攻击');
    b.allies[0].hp = 0;
    expect(render()).toBe('');
  });
});
