import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { battleInspection } from './battle-inspection';
import { selectAllies } from './ally-selection';
import { AllySelection } from './AllySelection';
import { BattleInspection } from './BattleInspection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
    { id: 11, kind: 'ember_mouse', rank: 3, position: { x: 2, y: 3 } },
    { id: 12, kind: 'shield_fox', rank: 2, position: { x: 5, y: 1 } },
  ]);
  battle.allies.find((unit) => unit.id === 10)!.hp = 0;
  spawnEnemy(battle, 'wolf', { x: 2, y: 0 }).target = 11;
  battle.allies.reverse();
  return battle;
}

test('种类计数含倒下者不含备战席，状态计数基于当前种类，保留原行列顺序与准确编号', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const view = battleInspection(battle, [{ id: 99, kind: 'boar', rank: 1, position: null }])!;
  const viewBefore = JSON.stringify(view);
  const all = selectAllies(view.allies, 'all', 'all', 11);
  expect(all.kinds).toEqual([
    { kind: 'shield_fox', name: '月音狐', count: 1 },
    { kind: 'ember_mouse', name: '烬灵鼠', count: 2 },
  ]);
  expect(all.allies.map((unit) => unit.id)).toEqual([12, 10, 11]);
  expect(all.selectedId).toBe(11);
  expect(all.counts).toEqual({
    all: 3,
    alive: 2,
    fallen: 1,
    shielded: 0,
    unshielded: 2,
    targeted: 1,
    untargeted: 1,
  });
  const mice = selectAllies(view.allies, 'ember_mouse', 'alive', 10);
  expect(mice.counts).toEqual({
    all: 2,
    alive: 1,
    fallen: 1,
    shielded: 0,
    unshielded: 1,
    targeted: 1,
    untargeted: 0,
  });
  expect(mice.selectedId).toBe(11);
  expect(mice.allies.map((unit) => unit.id)).toEqual([11]);
  expect(mice.total).toBe(3);
  expect(JSON.stringify(view)).toBe(viewBefore);
  expect(JSON.stringify(battle)).toBe(before);
});

test('改变条件保留匹配实例，否则选首只；返回全部保留当前选择', () => {
  const allies = battleInspection(setup(), [])!.allies;
  expect(selectAllies(allies, 'ember_mouse', 'all', 11).selectedId).toBe(11);
  expect(selectAllies(allies, 'ember_mouse', 'fallen', 11).selectedId).toBe(10);
  expect(selectAllies(allies, 'all', 'all', 10).selectedId).toBe(10);
  expect(selectAllies(allies, 'all', 'alive', 999).selectedId).toBe(12);
});

test('空交集保留筛选与计数、不回退其他实例；缺失种类回全部，编号0有效', () => {
  const allies = battleInspection(setup(), [])!.allies;
  const empty = selectAllies(allies, 'shield_fox', 'fallen', 11);
  expect(empty).toMatchObject({
    kind: 'shield_fox',
    status: 'fallen',
    allies: [],
    selectedId: undefined,
    counts: { all: 1, alive: 1, fallen: 0 },
    total: 3,
  });
  expect(selectAllies(allies, 'boar', 'fallen', 11)).toMatchObject({
    kind: 'all',
    status: 'fallen',
    selectedId: 10,
  });
  allies[0].id = 0;
  expect(selectAllies(allies, 'all', 'all', 0).selectedId).toBe(0);
});

test.each([null, []])('空投影安全，不伪造任何候选或计数', (allies) => {
  expect(selectAllies(allies, 'ember_mouse', 'alive', 999)).toMatchObject({
    kind: 'all',
    status: 'alive',
    kinds: [],
    allies: [],
    selectedId: undefined,
    counts: { all: 0, alive: 0, fallen: 0 },
    total: 0,
  });
});

test('倒下者缺旧战报也可筛选，累计记录不参与判断', () => {
  const battle = setup();
  delete battle.report;
  const fallen = selectAllies(battleInspection(battle, [])!.allies, 'all', 'fallen', undefined);
  expect(fallen.allies[0]).toMatchObject({ id: 10, alive: false, stats: null });
});

test('受控选择控件显示种类/状态计数及同种不同阶坐标，渲染只读', () => {
  const selection = selectAllies(battleInspection(setup(), [])!.allies, 'ember_mouse', 'all', 11);
  const before = JSON.stringify(selection);
  const html = renderToStaticMarkup(
    <AllySelection selection={selection} onKind={noop} onStatus={noop} onSelect={noop} />,
  );
  expect(html).toContain('aria-label="灵兽种类"');
  expect(html).toContain('<option value="ember_mouse" selected="">烬灵鼠 · 2只</option>');
  expect(html).toContain('aria-label="灵兽状态"');
  expect(html).toContain('<option value="alive">存活 · 1只</option>');
  expect(html).toContain('<option value="fallen">已倒下 · 1只</option>');
  expect(html).toContain('1阶 · 2列4行 · 已倒下');
  expect(html).toContain('3阶 · 3列4行 · 存活');
  expect(html).toContain('value="11" selected=""');
  expect(html).toContain('当前显示 2 / 3 只上阵灵兽');
  expect(JSON.stringify(selection)).toBe(before);
});

test('空交集保留筛选和明确空态，不输出无效实例select', () => {
  const selection = selectAllies(battleInspection(setup(), [])!.allies, 'shield_fox', 'fallen', 11);
  const html = renderToStaticMarkup(
    <AllySelection selection={selection} onKind={noop} onStatus={noop} onSelect={noop} />,
  );
  expect(html).toContain('aria-label="灵兽种类"');
  expect(html).toContain('aria-label="灵兽状态"');
  expect(html).not.toContain('aria-label="查看灵兽"');
  expect(html).toContain('当前筛选下没有上阵灵兽，请调整种类或状态');
});

test('战场详情接入筛选并保持默认受击压力选择、完整总览及只读', () => {
  const session = rosterPlaytest();
  session.start();
  const target = session.battle!.allies[1];
  spawnEnemy(session.battle!, 'wolf', { x: 1, y: -1 }).target = target.id;
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} />,
  );
  expect(html).toContain('aria-label="灵兽种类"');
  expect(html).toContain('aria-label="灵兽状态"');
  expect(html).toContain(`value="${target.id}" selected=""`);
  expect(html).toContain('阵线总览');
  expect(html).toContain('本关累计贡献');
  expect(JSON.stringify(session)).toBe(before);
});
