import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { contact, spawnEnemy } from '../game/combat-skills';
import { bossDefinition, clone, config, enemyDefinitions, type EnemyKind } from '../game/content';
import { enemyAttack } from './enemy-attack';
import { EnemyAttack, EnemyAttackContent } from './EnemyAttack';
import { enemyInspection } from './enemy-inspection';
import { EnemyInspection } from './EnemyInspection';

function setup(kind: EnemyKind = 'wolf', stageId = 1) {
  const b = createCombat(
    [
      { id: 10, kind: 'boar', rank: 1, position: { x: 1, y: 3 } },
      { id: 11, kind: 'fortune_peach', rank: 1, position: { x: 4, y: 3 } },
    ],
    { stageId },
  );
  b.spawns = [];
  for (const ally of b.allies) {
    ally.hp = ally.maxHp = 1e6;
    ally.cooldown = 1e8;
  }
  const e = spawnEnemy(b, kind, { x: 1.5, y: 3.5 });
  e.target = 10;
  e.recheckAt = 1e8;
  e.nextCleave = e.nextSummon = 1e8;
  return { b, e };
}

describe('暂停敌人普攻状态', () => {
  it('真实普攻前摇与冷却独立，到期命中且最后一个tick再次就绪', () => {
    const { b, e } = setup();
    expect(enemyAttack(b, e.id)!.status).toBe('已就绪 · 已接近锁定目标');
    stepCombat(b);
    const due = b.attacks.find((a) => a.team === 'enemy')!.due;
    expect(enemyAttack(b, e.id)).toMatchObject({
      status: '普攻冷却中',
      cooldownMs: e.cooldown - config.runtime.tickMs,
      pending: [{ targetId: 10, targetAlive: true, remainingMs: due - b.time }],
    });
    while (b.time < due) stepCombat(b);
    expect(enemyAttack(b, e.id)!.pending[0].remainingMs).toBe(0);
    const hp = b.allies[0].hp;
    stepCombat(b);
    expect(b.allies[0].hp).toBeLessThan(hp);
    expect(enemyAttack(b, e.id)!.pending).toEqual([]);
    while (e.cooldown > config.runtime.tickMs) stepCombat(b);
    expect(enemyAttack(b, e.id)).toMatchObject({
      cooldownMs: 0,
      status: '已就绪 · 已接近锁定目标',
    });
    stepCombat(b);
    expect(enemyAttack(b, e.id)!.pending).toHaveLength(1);
  });

  it('当前锁定改变不替换已准备目标，双方ID相同仍读取己方，真实释放伤害原目标', () => {
    const { b, e } = setup();
    e.id = 10;
    stepCombat(b);
    const attack = b.attacks.find((a) => a.team === 'enemy')!;
    e.target = 11;
    const projected = enemyInspection(b)!.enemies[0];
    expect(projected.target!.id).toBe(11);
    expect(projected.attack!.pending[0]).toMatchObject({
      targetId: 10,
      target: { kind: 'boar', id: 10 },
    });
    b.time = attack.due;
    const before = b.allies.map((u) => u.hp);
    stepCombat(b);
    expect(b.allies[0].hp).toBeLessThan(before[0]);
    expect(b.allies[1].hp).toBe(before[1]);
  });

  it('冻结时真实冷却和准备计时暂停，解冻恢复；冻结到期边界不再标记冻结', () => {
    const { b, e } = setup();
    stepCombat(b);
    e.frozenUntil = b.time + 3 * config.runtime.tickMs;
    const before = enemyAttack(b, e.id)!;
    expect(before.status).toBe('冻结中 · 普攻暂停');
    for (let i = 0; i < 3; i++) {
      stepCombat(b);
      expect(enemyAttack(b, e.id)!.cooldownMs).toBe(before.cooldownMs);
      expect(enemyAttack(b, e.id)!.pending).toEqual(before.pending);
    }
    expect(enemyAttack(b, e.id)!.frozenMs).toBe(0);
    stepCombat(b);
    expect(enemyAttack(b, e.id)!.cooldownMs).toBe(before.cooldownMs - config.runtime.tickMs);
    expect(enemyAttack(b, e.id)!.pending[0].remainingMs).toBe(
      before.pending[0].remainingMs - config.runtime.tickMs,
    );
  });

  it.each(['wolf', 'ranged', 'boss'] as const)(
    '%s使用实际射程与完整多格接触点及容差，缺目标不推测寻敌',
    (kind) => {
      const { b, e } = setup(kind, 5);
      const range =
        kind === 'boss' ? bossDefinition(5).rangeCells : enemyDefinitions[kind].rangeCells;
      e.x = 2.5 + range;
      expect(contact(b.allies[0], e)).toEqual({ x: 2.5, y: 3.5 });
      expect(enemyAttack(b, e.id)!.status).toContain('已就绪');
      e.x += 1e-10;
      expect(enemyAttack(b, e.id)!.status).toContain('已就绪');
      e.x += 1e-6;
      expect(enemyAttack(b, e.id)!.status).toBe('正在接近锁定目标');
      e.target = 999;
      expect(enemyAttack(b, e.id)!.status).toBe('等待重新寻敌');
      e.target = null;
      expect(enemyAttack(b, e.id)!.status).toBe('等待重新寻敌');
      e.kind = undefined;
      e.target = 10;
      e.x = 2.5 + enemyDefinitions.wolf.rangeCells;
      expect(enemyAttack(b, e.id)!.status).toContain('已就绪');
    },
  );

  it('筛选和排序只读，失效目标无跳转数据，死亡来源/缺ID/空战斗安全', () => {
    const { b, e } = setup();
    b.allies[0].hp = 0;
    b.time = 200;
    b.attacks = [
      { team: 'enemy', source: e.id, target: 11, ordinal: 0, due: 500 },
      { team: 'enemy', source: e.id, target: 999, ordinal: 0, due: 100 },
      { team: 'enemy', source: e.id, target: 10, ordinal: 0, due: 500 },
      { team: 'ally', source: e.id, target: 11, ordinal: 1, due: 100 },
      { team: 'enemy', source: 999, target: 11, ordinal: 0, due: 100 },
    ];
    const before = clone(b);
    const model = enemyAttack(b, e.id)!;
    expect(model.pending.map((a) => [a.targetId, a.targetAlive, a.remainingMs])).toEqual([
      [999, false, 0],
      [10, false, 300],
      [11, true, 300],
    ]);
    expect(model.pending[0].target).toBeNull();
    model.pending[1].target!.position.x = 99;
    expect(b).toEqual(before);
    e.hp = 0;
    expect(enemyAttack(b, e.id)).toBeNull();
    expect(enemyAttack(b, 999)).toBeNull();
    expect(enemyAttack(null, e.id)).toBeNull();
  });

  it('实际失效普攻不伤害其他存活灵兽，准备目标不自动改为当前锁定', () => {
    const { b, e } = setup();
    stepCombat(b);
    const attack = b.attacks.find((a) => a.team === 'enemy')!;
    b.allies[0].hp = 0;
    e.target = 11;
    expect(enemyAttack(b, e.id)!.pending[0].targetAlive).toBe(false);
    b.time = attack.due;
    const hp = b.allies[1].hp;
    stepCombat(b);
    expect(b.allies[1].hp).toBe(hp);
    expect(b.damageTaken).toBe(0);
  });

  it('渲染区分准备目标/冻结0秒/失效空态，默认收起且无失效按钮', () => {
    const { b, e } = setup();
    b.attacks.push({ team: 'enemy', source: e.id, target: 10, due: 50, ordinal: 0 });
    const content = () =>
      renderToStaticMarkup(
        createElement(EnemyAttackContent, { model: enemyAttack(b, e.id)!, onTarget: () => {} }),
      );
    expect(content()).toContain('查看普攻目标：岩甲豚1阶，编号10，2列4行');
    expect(content()).toContain('剩余 0.1 秒');
    b.time = 50;
    e.frozenUntil = 150;
    expect(content()).toContain('待解冻');
    expect(content()).not.toContain('待释放');
    b.allies[0].hp = 0;
    expect(content()).toContain('目标已倒下或未记录，此次普攻不会生效');
    expect(content()).not.toContain('<button');
    b.attacks = [];
    expect(content()).toContain('当前没有准备中的普攻');
    const collapsed = renderToStaticMarkup(
      createElement(EnemyAttack, { model: enemyAttack(b, e.id), onTarget: () => {} }),
    );
    expect(collapsed).toContain('当前普攻状态');
    expect(collapsed).not.toContain(' open=');
    expect(collapsed).not.toContain('当前没有准备中的普攻');
    const complete = renderToStaticMarkup(
      createElement(EnemyInspection, {
        view: enemyInspection(b),
        stageId: 1,
        selectedId: e.id,
        onSelect: () => {},
        onTarget: () => {},
      }),
    );
    expect(complete).toContain('当前普攻状态');
    expect(complete).not.toContain('准备中的普攻');
  });
});
