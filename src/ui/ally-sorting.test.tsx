import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { battleInspection } from './battle-inspection';
import { allySortLabel, sortAllies } from './ally-sorting';
import { selectAllies } from './ally-selection';
import { AllySelection } from './AllySelection';
import type { InspectedAlly } from './battle-inspection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 1 } },
    { id: 11, kind: 'ember_mouse', rank: 6, position: { x: 2, y: 1 } },
    { id: 12, kind: 'shield_fox', rank: 3, position: { x: 4, y: 0 } },
    { id: 13, kind: 'fortune_peach', rank: 3, position: { x: 5, y: 5 } },
  ]);
  battle.allies[0].hp = battle.allies[0].maxHp * 0.5;
  battle.allies[1].hp = battle.allies[1].maxHp * 0.1;
  battle.allies[2].hp = 0;
  spawnEnemy(battle, 'wolf', { x: 1, y: 0 }).target = 10;
  spawnEnemy(battle, 'wolf', { x: 2, y: 0 }).target = 11;
  spawnEnemy(battle, 'wolf', { x: 3, y: 0 }).target = 11;
  Object.assign(battle.report!.units.find((e) => e.id === 10)!, {
    damageDone: 5.1,
    damageTaken: 10,
    shieldGiven: 0,
    shieldAbsorbed: 1,
    income: 0,
  });
  Object.assign(battle.report!.units.find((e) => e.id === 11)!, {
    damageDone: 5.9,
    damageTaken: 2,
    shieldGiven: 1,
    shieldAbsorbed: 0,
    income: 1,
  });
  Object.assign(battle.report!.units.find((e) => e.id === 12)!, {
    damageDone: 0,
    damageTaken: 20,
    shieldGiven: 100,
    shieldAbsorbed: 50,
    income: 0,
  });
  Object.assign(battle.report!.units.find((e) => e.id === 13)!, { income: 30 });
  return battle;
}

test('按生命比例而非绝对血量排列，真实倒下者0先于残血、返回副本且全JSON只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const view = battleInspection(battle, [])!;
  const viewBefore = JSON.stringify(view);
  expect(view.allies.find((e) => e.id === 10)!.hp).toBeLessThan(
    view.allies.find((e) => e.id === 11)!.hp,
  );
  const sorted = sortAllies(view.allies, 'health');
  expect(sorted.map((e) => e.id)).toEqual([12, 11, 10, 13]);
  expect(sorted).not.toBe(view.allies);
  expect(allySortLabel(sorted[0], 'health')).toBe('生命 0%');
  expect(allySortLabel(sorted[1], 'health')).toBe('生命 10%');
  expect(JSON.stringify(view)).toBe(viewBefore);
  expect(JSON.stringify(battle)).toBe(before);
});

test.each([
  ['targeted', [11, 10, 12, 13]],
  ['damageDone', [11, 10, 12, 13]],
  ['damageTaken', [12, 10, 11, 13]],
  ['shieldGiven', [12, 11, 10, 13]],
  ['shieldAbsorbed', [12, 10, 11, 13]],
  ['income', [13, 11, 12, 10]],
] as const)('真实投影按%s降序，同值按站位而非输入顺序', (order, ids) => {
  const allies = battleInspection(setup(), [])!.allies.reverse();
  expect(sortAllies(allies, order).map((e) => e.id)).toEqual(ids);
});

test('缺贡献及部分缺字段排真实0之后，不把缺值当0；比较原小数，显示取整', () => {
  const allies = battleInspection(setup(), [])!.allies;
  allies.find((e) => e.id === 12)!.stats = null;
  delete (allies.find((e) => e.id === 13)!.stats as Partial<NonNullable<InspectedAlly['stats']>>)
    .damageDone;
  expect(sortAllies(allies, 'damageDone').map((e) => e.id)).toEqual([11, 10, 12, 13]);
  expect(allySortLabel(allies.find((e) => e.id === 10)!, 'damageDone')).toBe('伤害 5');
  expect(allySortLabel(allies.find((e) => e.id === 13)!, 'damageDone')).toBe('伤害 未记录');
  allies.find((e) => e.id === 10)!.stats!.damageDone = 0;
  expect(sortAllies(allies, 'damageDone').map((e) => e.id)).toEqual([11, 10, 12, 13]);
});

test('非有限值与无效生命上限排末尾，同位同值按编号；空数组安全', () => {
  const allies = battleInspection(setup(), [])!.allies;
  const first = allies[0];
  first.hp = NaN;
  first.alive = true;
  expect(sortAllies(allies, 'health').at(-1)?.id).toBe(first.id);
  expect(allySortLabel(first, 'health')).toBe('生命 未记录');
  first.hp = 10;
  first.maxHp = 0;
  expect(allySortLabel(first, 'health')).toBe('生命 未记录');
  first.stats!.income = Infinity;
  expect(sortAllies(allies, 'income').at(-1)?.id).toBe(first.id);
  const tied = allies.map((e) => ({ ...e, position: { x: 1, y: 1 }, targetedBy: 0 }));
  expect(sortAllies(tied.reverse(), 'targeted').map((e) => e.id)).toEqual([10, 11, 12, 13]);
  expect(sortAllies([], 'health')).toEqual([]);
});

test('排序保留当前编号，筛选失配按该排序选首只，统计与原站位序不变', () => {
  const view = battleInspection(setup(), [])!;
  expect(selectAllies(view.allies, 'all', 'all', 10, 'damageDone').selectedId).toBe(10);
  const chosen = selectAllies(view.allies, 'ember_mouse', 'alive', 12, 'health');
  expect(chosen).toMatchObject({
    order: 'health',
    selectedId: 11,
    counts: { all: 2, alive: 2, fallen: 0 },
    total: 4,
  });
  expect(chosen.allies.map((e) => e.id)).toEqual([11, 10]);
  expect(
    selectAllies(view.allies, 'ember_mouse', 'fallen', 11, 'damageDone').selectedId,
  ).toBeUndefined();
  expect(selectAllies(view.allies, 'all', 'all', undefined).allies.map((e) => e.id)).toEqual([
    12, 10, 11, 13,
  ]);
});

test('排序控件显示选中指标与逐只数值，旧记录明确缺失，空筛选保留排序', () => {
  const allies = battleInspection(setup(), [])!.allies;
  allies.find((e) => e.id === 12)!.stats = null;
  const selection = selectAllies(allies, 'all', 'all', 10, 'damageDone');
  const html = renderToStaticMarkup(
    <AllySelection
      selection={selection}
      onKind={noop}
      onStatus={noop}
      onSelect={noop}
      onOrder={noop}
    />,
  );
  expect(html).toContain('aria-label="灵兽排序"');
  expect(html).toContain('<option value="damageDone" selected="">本关伤害 · 从高到低</option>');
  expect(html).toContain('伤害 未记录');
  expect(html).toContain('伤害 5');
  expect(html).toContain('value="10" selected=""');
  expect(html).toContain('本关累计，不是每秒数值');
  const empty = renderToStaticMarkup(
    <AllySelection
      selection={selectAllies(allies, 'ember_mouse', 'fallen', 10, 'health')}
      onKind={noop}
      onStatus={noop}
      onSelect={noop}
      onOrder={noop}
    />,
  );
  expect(empty).toContain('aria-label="灵兽排序"');
  expect(empty).toContain('当前筛选下没有上阵灵兽');
  expect(empty).not.toContain('aria-label="查看灵兽"');
});
