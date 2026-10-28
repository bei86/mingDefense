import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { attackDamage } from '../game/combat-skills';
import { heroes } from '../game/content';
import { battleStats } from './battle-stats';
import { AuraCoverage } from './AuraCoverage';

const noop = () => {};
function setup() {
  return createCombat([
    { id: 30, kind: 'shield_fox', rank: 3, position: { x: 2, y: 2 } },
    { id: 12, kind: 'ember_mouse', rank: 4, position: { x: 1, y: 3 } },
    { id: 8, kind: 'ember_mouse', rank: 4, position: { x: 0, y: 2 } },
    { id: 0, kind: 'scatter_bear', rank: 4, position: { x: 0, y: 0 } },
    { id: 9, kind: 'ember_mouse', rank: 4, position: { x: 5, y: 2 } },
    { id: 50, kind: 'fortune_peach', rank: 6, position: { x: 2, y: 1 } },
  ]);
}

test('按站位列真实攻击受益者，0编号与同阶不同编号可辨，整体中心精确边界与真实命中一致且只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const model = battleStats(battle, 30)!;
  expect(model.auraTargets.map((target) => target.id)).toEqual([0, 8, 12]);
  for (const ally of battle.allies.filter(
    (unit) => !['shield_fox', 'fortune_peach'].includes(unit.kind),
  )) {
    const covered = model.auraTargets.some((target) => target.id === ally.id);
    expect(battleStats(battle, ally.id)!.auraSources.some((source) => source.id === 30)).toBe(
      covered,
    );
    expect(attackDamage(battle, ally)).toBeCloseTo(
      heroes[ally.kind].hitDamage[ally.rank - 1] * (covered ? 1.1 : 1),
    );
  }
  const html = renderToStaticMarkup(<AuraCoverage model={model} onSelect={noop} />);
  expect(html).toContain('攻击光环覆盖 · 3只');
  expect(html).not.toContain('open=""');
  expect(html).toContain('aria-label="查看光环伙伴：磐拳熊4阶，1列1行，编号0"');
  expect(html).toContain('aria-label="查看光环伙伴：烬灵鼠4阶，1列3行，编号8"');
  expect(html).toContain('aria-label="查看光环伙伴：烬灵鼠4阶，2列4行，编号12"');
  expect(html.match(/type="button"/g)).toHaveLength(3);
  expect(JSON.stringify(battle)).toBe(before);
  model.auraTargets[0].position.x = 99;
  expect(JSON.stringify(battle)).toBe(before);
});

test('固定光环不受射程天赋扩大，边界外/倒下目标/桃/狐排除，多个光环不叠加', () => {
  const battle = setup();
  battle.progression.buffs.range = 3;
  battle.allies[1].hp = 0;
  battle.allies.push({ ...battle.allies[0], id: 40, position: { x: 2, y: 3 } });
  expect(battleStats(battle, 30)!.auraTargets.map((target) => target.id)).toEqual([0, 8]);
  const mouse = battle.allies.find((unit) => unit.id === 8)!;
  expect(battleStats(battle, 8)!.auraSources.map((source) => source.id)).toEqual([30, 40]);
  expect(attackDamage(battle, mouse)).toBeCloseTo(heroes.ember_mouse.hitDamage[3] * 1.1);
  battle.allies[0].position.x = 3;
  expect(battleStats(battle, 30)!.auraTargets.map((target) => target.id)).toEqual([9]);
  expect(battleStats(battle, 40)!.auraTargets.map((target) => target.id)).toContain(8);
  battle.allies[0].hp = 0;
  expect(battleStats(battle, 30)!.auraTargets).toEqual([]);
  expect(battleStats(battle, 8)!.auraSources.map((source) => source.id)).toEqual([40]);
});

test('低阶/倒下/无伙伴状态分别说明，其他种类无覆盖面板，低阶和倒下者不保留名单', () => {
  const battle = setup();
  const render = (id = 30) =>
    renderToStaticMarkup(<AuraCoverage model={battleStats(battle, id)!} onSelect={noop} />);
  battle.allies[0].rank = 2;
  expect(battleStats(battle, 30)!.auraTargets).toEqual([]);
  expect(render()).toContain('攻击光环需3阶解锁，此狐尚未解锁。');
  expect(render()).not.toContain('<button');
  battle.allies[0].hp = 0;
  expect(render()).toContain('此狐已倒下，攻击光环已失效。');
  battle.allies[0].hp = battle.allies[0].maxHp;
  battle.allies[0].rank = 3;
  for (const unit of battle.allies.slice(1)) unit.hp = 0;
  expect(render()).toContain('当前没有可受攻击加成的存活伙伴。');
  expect(render()).not.toContain('<button');
  expect(render(8)).toBe('');
  expect(render(50)).toBe('');
});
