import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { battleInspection } from './battle-inspection';
import { selectAllies } from './ally-selection';
import { AllySelection } from './AllySelection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 0, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
    { id: 1, kind: 'ember_mouse', rank: 3, position: { x: 1, y: 1 } },
    { id: 2, kind: 'shield_fox', rank: 3, position: { x: 3, y: 2 } },
    { id: 3, kind: 'fortune_peach', rank: 3, position: { x: 5, y: 5 } },
    { id: 4, kind: 'boar', rank: 1, position: null },
    { id: 5, kind: 'fortune_peach', rank: 1, position: { x: 4, y: 4 } },
  ]);
  battle.time = 1000;
  battle.allies.find((unit) => unit.id === 3)!.hp = 0;
  for (const target of [0, 0, 1, null, 99, 3]) {
    spawnEnemy(battle, 'wolf', { x: 0, y: -8 }).target = target;
  }
  battle.enemies[2].frozenUntil = 3000;
  const dead = spawnEnemy(battle, 'wolf', { x: 0, y: -8 });
  dead.target = 2;
  dead.hp = 0;
  // A prepared attack or a sweep does not change the cached target filter.
  battle.attacks.push({
    due: 1200,
    source: battle.enemies[0].id,
    target: 2,
    team: 'enemy',
    ordinal: 1,
  });
  battle.warnings.push({ source: battle.enemies[0].id, row: 2, due: 1200 });
  delete battle.report;
  battle.allies.reverse();
  return battle;
}

test('仅存活缓存决定锁定压力：编号0、冻结/接近有效，死亡/无效缓存/准备动作/横扫不混入，投影只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const view = battleInspection(battle, [{ id: 4, kind: 'boar', rank: 1, position: null }])!;
  const snapshot = JSON.stringify(view);
  const targeted = selectAllies(view.allies, 'all', 'targeted', 0, 'targeted');
  expect(targeted.allies.map((unit) => [unit.id, unit.targetedBy])).toEqual([
    [0, 2],
    [1, 1],
  ]);
  expect(targeted.selectedId).toBe(0);
  expect(selectAllies(view.allies, 'all', 'untargeted', 0).allies.map((unit) => unit.id)).toEqual([
    2, 5,
  ]);
  expect(targeted.counts).toMatchObject({
    all: 5,
    alive: 4,
    fallen: 1,
    targeted: 2,
    untargeted: 2,
  });
  expect(JSON.stringify(view)).toBe(snapshot);
  expect(JSON.stringify(battle)).toBe(before);
});

test('数量按当前种类统计并守恒，空交集不回退，匹配实例保留，失配按当前排序选首只', () => {
  const allies = battleInspection(setup(), [])!.allies;
  for (const kind of ['all', 'ember_mouse', 'shield_fox', 'fortune_peach'] as const) {
    const group = selectAllies(allies, kind, 'targeted', 1, 'targeted');
    expect(group.counts.targeted + group.counts.untargeted).toBe(group.counts.alive);
    expect(group.allies).toHaveLength(group.counts.targeted);
  }
  expect(selectAllies(allies, 'all', 'targeted', 1, 'targeted').selectedId).toBe(1);
  expect(selectAllies(allies, 'all', 'targeted', 2, 'targeted').selectedId).toBe(0);
  expect(selectAllies(allies, 'all', 'untargeted', 0, 'targeted').selectedId).toBe(2);
  expect(selectAllies(allies, 'shield_fox', 'targeted', 0, 'targeted')).toMatchObject({
    kind: 'shield_fox',
    status: 'targeted',
    order: 'targeted',
    allies: [],
    selectedId: undefined,
    counts: { all: 1, alive: 1, targeted: 0, untargeted: 1 },
  });
  expect(selectAllies(allies, 'all', 'fallen', 3).allies.map((unit) => unit.id)).toEqual([3]);
  for (const status of ['targeted', 'untargeted'] as const) {
    expect(selectAllies(null, 'all', status, 0, 'targeted')).toMatchObject({
      status,
      allies: [],
      selectedId: undefined,
      counts: { targeted: 0, untargeted: 0 },
    });
  }
});

test('重新读取跟随缓存转移/清除与目标倒下，不缓存旧分组', () => {
  const battle = setup();
  const read = () =>
    selectAllies(battleInspection(battle, [])!.allies, 'all', 'targeted', 0, 'targeted');
  expect(read().allies.map((unit) => unit.id)).toEqual([0, 1]);
  battle.enemies[0].target = 2;
  battle.enemies[1].target = 2;
  expect(read().allies.map((unit) => unit.id)).toEqual([2, 1]);
  battle.allies.find((unit) => unit.id === 2)!.hp = 0;
  expect(read().allies.map((unit) => unit.id)).toEqual([1]);
  battle.enemies[2].target = null;
  expect(read()).toMatchObject({ allies: [], counts: { alive: 3, targeted: 0, untargeted: 3 } });
});

test('真实模拟取得缓存后进入被锁定组，来源倒下即从当前压力移除', () => {
  const battle = createCombat([{ id: 0, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } }]);
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 0, y: -8 });
  const read = () => selectAllies(battleInspection(battle, [])!.allies, 'all', 'targeted', 0);
  expect(read().allies).toEqual([]);
  stepCombat(battle);
  expect(read().allies.map((unit) => unit.id)).toEqual([0]);
  enemy.hp = 0;
  expect(read()).toMatchObject({ allies: [], counts: { targeted: 0, untargeted: 1 } });
});

test('控件按种类显示两组数量，锁定指标前置，空态保留筛选/排序而无实例和导航', () => {
  const allies = battleInspection(setup(), [])!.allies;
  const render = (kind: 'all' | 'shield_fox') =>
    renderToStaticMarkup(
      <AllySelection
        selection={selectAllies(allies, kind, 'targeted', 0, 'targeted')}
        onKind={noop}
        onStatus={noop}
        onSelect={noop}
        onOrder={noop}
      />,
    );
  const html = render('all');
  expect(html).toContain('<option value="targeted" selected="">被锁定（存活） · 2只</option>');
  expect(html).toContain('<option value="untargeted">未被锁定（存活） · 2只</option>');
  expect(html).toContain('<option value="0" selected="">锁定 2只 · 烬灵鼠');
  expect(html).toContain('锁定筛选只计存活敌人的当前缓存');
  expect(html).toContain('未被锁定不代表不会受伤');
  expect(html).toContain('排序保留当前查看的灵兽，不改变仇恨');
  expect(html).not.toContain('贡献为本关累计');
  const empty = render('shield_fox');
  expect(empty).toContain('aria-label="灵兽状态"');
  expect(empty).toContain('aria-label="灵兽排序"');
  expect(empty).toContain('当前筛选下没有上阵灵兽');
  expect(empty).not.toContain('aria-label="查看灵兽"');
  expect(empty).not.toContain('逐只查看灵兽');
});
