import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { BattleAction } from './BattleAction';
import { battleAction } from './battle-action';

const noop = () => {};
function setup(fox = false) {
  const battle = createCombat([
    { id: 10, kind: fox ? 'shield_fox' : 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
    { id: 0, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 0 } },
  ]);
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: 0.5 });
  enemy.id = 0;
  enemy.cooldown = 1e8;
  stepCombat(battle);
  return { battle, enemy };
}

test.each([false, true])('真实准备动作fox=%s准确区分双方同号0目标，模型与SSR渲染只读', (fox) => {
  const { battle } = setup(fox);
  const before = JSON.stringify(battle);
  const model = battleAction(battle, 10)!;
  expect(model.pending).toHaveLength(1);
  expect(model.pending[0]).toMatchObject({
    target: { side: fox ? 'ally' : 'enemy', id: 0 },
    targetAlive: true,
  });
  const html = renderToStaticMarkup(<BattleAction battle={battle} unitId={10} onTarget={noop} />);
  expect(html).toContain(
    fox ? 'aria-label="查看施盾目标：灵金桃1阶 · #0"' : 'aria-label="查看攻击目标：奔雷狼 · #0"',
  );
  expect(html).toContain('查看目标 ›');
  expect(html.match(/type="button"/g)).toHaveLength(1);
  expect(JSON.stringify(battle)).toBe(before);
});

test('同名敌人保留准确编号，倒下/退场目标仍显示动作文字但无跳转', () => {
  const { battle, enemy } = setup();
  const other = spawnEnemy(battle, 'wolf', { x: 1, y: 0.5 });
  battle.attacks.push({ ...battle.attacks[0], target: other.id, ordinal: 2 });
  const render = () =>
    renderToStaticMarkup(<BattleAction battle={battle} unitId={10} onTarget={noop} />);
  expect(battleAction(battle, 10)!.pending.map((action) => action.target)).toEqual([
    { side: 'enemy', id: 0 },
    { side: 'enemy', id: other.id },
  ]);
  expect(render()).toContain(`aria-label="查看攻击目标：奔雷狼 · #${other.id}"`);
  enemy.hp = 0;
  expect(render().match(/type="button"/g)).toHaveLength(1);
  expect(render()).toContain('目标：奔雷狼 · #0');
  battle.enemies = [];
  expect(render()).not.toContain('<button');
  expect(render()).toContain(`目标：#${other.id}`);
  expect(render()).toContain('目标已倒下或退场，此动作不会生效。');
});

test('施盾目标倒下或退场不能误跳同号存活敌人；无动作/桃/倒下施动者无目标按钮', () => {
  const { battle, enemy } = setup(true);
  battle.allies[1].hp = 0;
  const render = () =>
    renderToStaticMarkup(<BattleAction battle={battle} unitId={10} onTarget={noop} />);
  expect(enemy.hp).toBeGreaterThan(0);
  expect(render()).not.toContain('<button');
  expect(render()).toContain('目标：灵金桃1阶 · #0');
  battle.allies.pop();
  expect(render()).not.toContain('<button');
  expect(render()).toContain('目标：#0');
  battle.attacks = [];
  expect(render()).toContain('当前没有准备中的动作。');
  expect(render()).not.toContain('<button');
  battle.allies[0].kind = 'fortune_peach';
  expect(render()).not.toContain('<button');
  battle.allies[0].hp = 0;
  expect(render()).toBe('');
});
