import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { clone } from '../game/content';
import { battleInspection } from './battle-inspection';
import { enemiesTargeting, enemyInspection } from './enemy-inspection';
import { EnemyInspection } from './EnemyInspection';
import { AllyThreats } from './AllyThreats';

const noop = () => {};

function setup() {
  return createCombat(
    [
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 11, kind: 'ember_mouse', rank: 2, position: { x: 2, y: 3 } },
    ],
    { stageId: 5 },
  );
}

describe('暂停双方锁定查看', () => {
  it('真实双方投影数量一致，按实例区分同名与首领，不计死亡和失效目标且只读', () => {
    const b = setup();
    const wolf = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    const boss = spawnEnemy(b, 'boss', { x: 3, y: 0 });
    const second = spawnEnemy(b, 'wolf', { x: 2, y: 0 });
    wolf.target = 10;
    boss.target = 10;
    second.target = 11;
    const dead = spawnEnemy(b, 'wolf', { x: 4, y: 0 });
    dead.target = 10;
    dead.hp = 0;
    spawnEnemy(b, 'wolf', { x: 5, y: 0 }).target = 999;
    spawnEnemy(b, 'wolf', { x: 6, y: 0 });
    const before = clone(b);
    const enemies = enemyInspection(b);
    expect(enemiesTargeting(enemies, 10).map((e) => e.id)).toEqual([boss.id, wolf.id]);
    expect(enemiesTargeting(enemies, 11).map((e) => e.id)).toEqual([second.id]);
    for (const ally of battleInspection(b, [])!.allies)
      expect(enemiesTargeting(enemies, ally.id)).toHaveLength(ally.targetedBy);
    expect(enemiesTargeting(enemies, 999)).toEqual([]);
    expect(b).toEqual(before);
    b.allies[0].hp = 0;
    expect(enemiesTargeting(enemyInspection(b), 10)).toEqual([]);
    expect(enemiesTargeting(null, 10)).toEqual([]);
  });

  it('敌人受控选择精确到第二只同名实例，目标入口正确，失效目标不提供跳转', () => {
    const b = setup();
    const first = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    const second = spawnEnemy(b, 'wolf', { x: 2, y: 0 });
    first.target = 10;
    second.target = 11;
    const render = (selectedId: number) =>
      renderToStaticMarkup(
        createElement(EnemyInspection, {
          view: enemyInspection(b),
          stageId: b.stageId,
          selectedId,
          onSelect: noop,
          onTarget: noop,
        }),
      );
    expect(render(second.id)).toContain(`<small>#${second.id}</small>`);
    expect(render(second.id)).toContain('查看锁定灵兽：烬灵鼠2阶，3列4行');
    expect(render(999)).toContain(`<small>#${first.id}</small>`);
    b.allies[1].hp = 0;
    expect(render(second.id)).not.toContain('查看锁定灵兽：');
    expect(render(second.id)).toContain('原目标已倒下或未记录');
    second.target = null;
    expect(render(second.id)).not.toContain('查看锁定灵兽：');
    b.enemies = [];
    expect(render(second.id)).toContain('当前场上没有存活敌人');
  });

  it('锁定列表默认收起，零锁定无空入口，渲染不改变输入', () => {
    const b = setup();
    spawnEnemy(b, 'wolf', { x: 1, y: 0 }).target = 10;
    const enemies = enemiesTargeting(enemyInspection(b), 10);
    const before = clone(enemies);
    const html = renderToStaticMarkup(createElement(AllyThreats, { enemies, onSelect: noop }));
    expect(html).toContain('锁定此灵兽的敌人');
    expect(html).toContain('1只');
    expect(html).not.toContain(' open=');
    expect(html).not.toContain('<button');
    expect(enemies).toEqual(before);
    expect(renderToStaticMarkup(createElement(AllyThreats, { enemies: [], onSelect: noop }))).toBe(
      '',
    );
  });
});
