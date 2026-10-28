import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { enemyInspection } from './enemy-inspection';
import { selectEnemies, type EnemyStatusFilter } from './enemy-selection';
import { inspectionNeighbors } from './inspection-navigation';
import { EnemySelection } from './EnemySelection';
import { EnemyInspection } from './EnemyInspection';

const noop = () => {};
function setup() {
  const battle = createCombat(
    [{ id: 100, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 5 } }],
    { stageId: 50 },
  );
  battle.time = 1000;
  battle.nextEnemyId = 0;
  battle.progression.buffs.slow = 2;
  Object.assign(spawnEnemy(battle, 'wolf', { x: 0, y: -8 }), {
    hp: 20,
    maxHp: 100,
    frozenUntil: 1001,
    slowUntil: 3000,
    vulnerabilityUntil: 2000,
    vulnerabilityPercent: 0,
  });
  Object.assign(spawnEnemy(battle, 'wolf', { x: 1, y: -8 }), {
    hp: 10,
    maxHp: 100,
    frozenUntil: 1000,
    slowUntil: 1001,
  });
  Object.assign(spawnEnemy(battle, 'boss', { x: 2, y: -8 }), {
    vulnerabilityUntil: 3000,
    vulnerabilityPercent: undefined,
  });
  spawnEnemy(battle, 'summoned_wolf', { x: 3, y: -8 });
  Object.assign(spawnEnemy(battle, 'wolf', { x: 4, y: -8 }), {
    hp: 0,
    frozenUntil: 3000,
    slowUntil: 3000,
    vulnerabilityUntil: 3000,
  });
  battle.enemies.reverse();
  return battle;
}

test('类型化局部状态沿用有效期，支持重叠与编号0，迟滞/死亡/未出场不混入且全投影只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  const snapshot = JSON.stringify(view);
  expect(view.enemies.find((e) => e.id === 0)!.statuses).toEqual([
    'frozen',
    'slowed',
    'vulnerable',
  ]);
  const groups: [EnemyStatusFilter, number[]][] = [
    ['all', [2, 0, 1, 3]],
    ['frozen', [0]],
    ['slowed', [0, 1]],
    ['vulnerable', [2, 0]],
    ['unaffected', [3]],
  ];
  for (const [status, ids] of groups) {
    const selection = selectEnemies(view, 'all', 0, 'default', status);
    expect(selection.enemies.map((e) => e.id)).toEqual(ids);
    expect(selection.counts).toEqual({
      all: 4,
      frozen: 1,
      slowed: 2,
      vulnerable: 2,
      unaffected: 1,
    });
  }
  expect(view.enemies.find((e) => e.id === 3)!.effects).toEqual([
    { label: '迟滞天赋', value: '移速 -10%' },
  ]);
  expect(JSON.stringify(view)).toBe(snapshot);
  expect(JSON.stringify(battle)).toBe(before);
});

test('种类内计数可重叠，不读显示标签；0与缺失易伤倍率沿用原有效期语义', () => {
  const view = enemyInspection(setup())!;
  const wolves = selectEnemies(view, 'wolf', 0, 'default', 'slowed');
  expect(wolves.counts).toEqual({ all: 2, frozen: 1, slowed: 2, vulnerable: 1, unaffected: 0 });
  expect(wolves.total).toBe(4);
  expect(view.enemies.find((e) => e.id === 0)!.effects.some((e) => e.value.startsWith('0%'))).toBe(
    true,
  );
  expect(
    view.enemies.find((e) => e.id === 2)!.effects.some((e) => e.value.startsWith('倍率未记录')),
  ).toBe(true);
  for (const enemy of view.enemies) enemy.effects = [{ label: '冻结', value: '任意显示文案' }];
  expect(selectEnemies(view, 'all', 0, 'default', 'frozen').enemies.map((e) => e.id)).toEqual([0]);
  expect(selectEnemies(view, 'all', 0, 'default', 'unaffected').enemies.map((e) => e.id)).toEqual([
    3,
  ]);
});

test('重新读取精确到期边界和真实tick后更新，不缓存旧名单', () => {
  const battle = setup();
  const read = (status: EnemyStatusFilter) =>
    selectEnemies(enemyInspection(battle), 'all', 0, 'default', status);
  expect(read('frozen').enemies.map((e) => e.id)).toEqual([0]);
  battle.spawns = [];
  stepCombat(battle);
  expect(battle.time).toBe(1050);
  expect(read('frozen').enemies).toEqual([]);
  expect(read('slowed').enemies.map((e) => e.id)).toEqual([0]);
  battle.time = 2000;
  expect(read('vulnerable').enemies.map((e) => e.id)).toEqual([2]);
  battle.time = 3000;
  expect(read('unaffected').enemies.map((e) => e.id)).toEqual([2, 0, 1, 3]);
});

test('保留匹配实例、失配按当前排序选首只，导航沿筛选名单，空交集保留条件', () => {
  const view = enemyInspection(setup())!;
  expect(selectEnemies(view, 'all', 0, 'hp', 'slowed').selectedId).toBe(0);
  const chosen = selectEnemies(view, 'wolf', 2, 'hp', 'slowed');
  expect(chosen.selectedId).toBe(1);
  expect(inspectionNeighbors(chosen.enemies, chosen.selectedId)).toMatchObject({
    position: 1,
    total: 2,
    nextId: 0,
  });
  expect(selectEnemies(view, 'boss', 0, 'health', 'frozen')).toMatchObject({
    kind: 'boss',
    status: 'frozen',
    order: 'health',
    enemies: [],
    selectedId: undefined,
    counts: { all: 1, frozen: 0, vulnerable: 1 },
  });
  expect(selectEnemies(view, 'all', 1, 'hp').selectedId).toBe(1);
  expect(selectEnemies(null, 'boss', 0, 'health', 'slowed')).toMatchObject({
    kind: 'all',
    status: 'slowed',
    order: 'health',
    enemies: [],
    selectedId: undefined,
    counts: { all: 0, frozen: 0, slowed: 0, vulnerable: 0, unaffected: 0 },
  });
});

test('状态选项/重叠说明与筛选计数明确，空交集有恢复入口而无实例/导航', () => {
  const view = enemyInspection(setup())!;
  const render = (kind: 'all' | 'boss') =>
    renderToStaticMarkup(
      <EnemySelection
        selection={selectEnemies(view, kind, 0, 'hp', 'frozen')}
        onKind={noop}
        onStatus={noop}
        onOrder={noop}
        onSelect={noop}
      />,
    );
  const html = render('all');
  expect(html).toContain('<option value="frozen" selected="">冻结 · 1只</option>');
  expect(html).toContain('<option value="slowed">霜尾缓行 · 2只</option>');
  expect(html).toContain('<option value="vulnerable">易伤 · 2只</option>');
  expect(html).toContain('<option value="unaffected">无局部状态 · 1只</option>');
  expect(html).toContain('状态可重叠');
  expect(html).toContain('全场迟滞天赋不计入局部状态');
  expect(html).toContain('value="0" selected=""');
  const empty = render('boss');
  for (const name of ['敌人种类', '敌人状态', '敌人排序'])
    expect(empty).toContain(`aria-label="${name}"`);
  expect(empty).toContain('当前筛选下没有存活敌人');
  expect(empty).not.toContain('aria-label="查看敌人"');
  expect(empty).not.toContain('逐只查看敌人');
});

test('详情默认接入状态控件，无活敌仍用原空态；渲染不改战斗', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const render = (view: ReturnType<typeof enemyInspection>) =>
    renderToStaticMarkup(
      <EnemyInspection
        view={view}
        stageId={50}
        selectedId={0}
        onSelect={noop}
        onTarget={noop}
        onIntel={noop}
      />,
    );
  expect(render(enemyInspection(battle))).toContain('aria-label="敌人状态"');
  expect(render(enemyInspection(battle))).toContain('查看奔雷狼敌情档案');
  expect(JSON.stringify(battle)).toBe(before);
  for (const view of [null, { enemies: [], initialId: undefined }]) {
    const html = render(view);
    expect(html).toContain('当前场上没有存活敌人');
    expect(html).not.toContain('aria-label="敌人状态"');
  }
});
