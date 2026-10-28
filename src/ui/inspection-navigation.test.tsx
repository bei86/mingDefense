import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { battleInspection } from './battle-inspection';
import { enemyInspection } from './enemy-inspection';
import { selectAllies } from './ally-selection';
import { selectEnemies } from './enemy-selection';
import { inspectionNeighbors } from './inspection-navigation';
import { InspectionNavigation } from './InspectionNavigation';
import { AllySelection } from './AllySelection';
import { EnemySelection } from './EnemySelection';

const noop = () => {};
function setup() {
  const battle = createCombat(
    [
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 4 } },
      { id: 20, kind: 'ember_mouse', rank: 6, position: { x: 2, y: 2 } },
      { id: 30, kind: 'scatter_bear', rank: 5, position: { x: 3, y: 3 } },
    ],
    { stageId: 50 },
  );
  battle.allies[0].hp = 0;
  battle.allies[1].hp = battle.allies[1].maxHp / 5;
  const wolf = spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: 0 });
  const second = spawnEnemy(battle, 'wolf', { x: 2, y: 0 });
  Object.assign(wolf, { hp: 50, maxHp: 100 });
  Object.assign(boss, { hp: 2000, maxHp: 10000 });
  Object.assign(second, { hp: 10, maxHp: 100 });
  return { battle, wolf, boss, second };
}

test('首中末只沿实际名单，不按编号相邻；边界不循环，编号0有效且输入只读', () => {
  const entries = [{ id: 8 }, { id: 0 }, { id: 32 }];
  const before = JSON.stringify(entries);
  expect(inspectionNeighbors(entries, 8)).toEqual({
    position: 1,
    total: 3,
    previousId: undefined,
    nextId: 0,
  });
  expect(inspectionNeighbors(entries, 0)).toEqual({
    position: 2,
    total: 3,
    previousId: 8,
    nextId: 32,
  });
  expect(inspectionNeighbors(entries, 32)).toEqual({
    position: 3,
    total: 3,
    previousId: 0,
    nextId: undefined,
  });
  expect(JSON.stringify(entries)).toBe(before);
});

test('0/1只、无当前编号或失效编号均无邻居，不猜其他实例', () => {
  for (const entries of [[], [{ id: 0 }]]) expect(inspectionNeighbors(entries, 0)).toBeNull();
  expect(inspectionNeighbors([{ id: 0 }, { id: 4 }], undefined)).toBeNull();
  expect(inspectionNeighbors([{ id: 0 }, { id: 4 }], 999)).toBeNull();
});

test('真实灵兽比例与种类/状态过滤后的顺序决定邻居，倒下者可以翻看，统计和战斗只读', () => {
  const { battle } = setup();
  const before = JSON.stringify(battle);
  const view = battleInspection(battle, [])!;
  const snapshot = JSON.stringify(view);
  const all = selectAllies(view.allies, 'all', 'all', 20, 'health');
  expect(inspectionNeighbors(all.allies, all.selectedId)).toEqual({
    position: 2,
    total: 3,
    previousId: 10,
    nextId: 30,
  });
  const mice = selectAllies(view.allies, 'ember_mouse', 'all', 20, 'health');
  expect(inspectionNeighbors(mice.allies, mice.selectedId)).toEqual({
    position: 2,
    total: 2,
    previousId: 10,
    nextId: undefined,
  });
  const alive = selectAllies(view.allies, 'ember_mouse', 'alive', 20, 'health');
  expect(inspectionNeighbors(alive.allies, alive.selectedId)).toBeNull();
  expect(mice.total).toBe(3);
  expect(JSON.stringify(view)).toBe(snapshot);
  expect(JSON.stringify(battle)).toBe(before);
});

test('真实同名敌人按筛选及生命比例翻看，默认首领顺序不同，单首领无导航且只读', () => {
  const { battle, wolf, boss, second } = setup();
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  const snapshot = JSON.stringify(view);
  const all = selectEnemies(view, 'all', boss.id, 'health');
  expect(inspectionNeighbors(all.enemies, all.selectedId)).toEqual({
    position: 2,
    total: 3,
    previousId: second.id,
    nextId: wolf.id,
  });
  const normal = selectEnemies(view, 'all', boss.id);
  expect(inspectionNeighbors(normal.enemies, normal.selectedId)?.position).toBe(1);
  const wolves = selectEnemies(view, 'wolf', wolf.id, 'health');
  expect(inspectionNeighbors(wolves.enemies, wolves.selectedId)).toEqual({
    position: 2,
    total: 2,
    previousId: second.id,
    nextId: undefined,
  });
  const single = selectEnemies(view, 'boss', boss.id, 'health');
  expect(inspectionNeighbors(single.enemies, single.selectedId)).toBeNull();
  expect(JSON.stringify(view)).toBe(snapshot);
  expect(JSON.stringify(battle)).toBe(before);
});

test.each([
  [8, true, false, 1],
  [0, false, false, 2],
  [32, false, true, 3],
] as const)('SSR当前编号%s的首尾禁用正确，不移除可发现的按钮', (id, previous, next, position) => {
  const html = renderToStaticMarkup(
    <InspectionNavigation
      entries={[{ id: 8 }, { id: 0 }, { id: 32 }]}
      selectedId={id}
      subject="灵兽"
      onSelect={noop}
    />,
  );
  expect(html).toContain('role="group" aria-label="逐只查看灵兽"');
  expect(html).toContain(`aria-label="上一只灵兽"${previous ? ' disabled=""' : ''}>上一只`);
  expect(html).toContain(`aria-label="下一只灵兽"${next ? ' disabled=""' : ''}>下一只`);
  expect(html).toContain(`role="status">第 ${position} / 3 只`);
  expect((html.match(/disabled=""/g) ?? []).length).toBe(Number(previous) + Number(next));
});

test('空/单只/无效编号隐藏导航，不输出空位置或错误目标', () => {
  for (const entries of [[], [{ id: 1 }], [{ id: 1 }, { id: 2 }]]) {
    expect(
      renderToStaticMarkup(
        <InspectionNavigation entries={entries} selectedId={999} subject="敌人" onSelect={noop} />,
      ),
    ).toBe('');
  }
});

test('双方选择控件在实例select后接入，序号来自筛选排序结果且保留具体选中编号', () => {
  const { battle, second } = setup();
  const allies = selectAllies(
    battleInspection(battle, [])!.allies,
    'ember_mouse',
    'all',
    20,
    'health',
  );
  const allyHtml = renderToStaticMarkup(
    <AllySelection
      selection={allies}
      onKind={noop}
      onStatus={noop}
      onOrder={noop}
      onSelect={noop}
    />,
  );
  expect(allyHtml).toContain('value="20" selected=""');
  expect(allyHtml).toContain('aria-label="逐只查看灵兽"');
  expect(allyHtml).toContain('role="status">第 2 / 2 只');
  expect(allyHtml.indexOf('aria-label="逐只查看灵兽"')).toBeGreaterThan(
    allyHtml.indexOf('aria-label="查看灵兽"'),
  );
  const enemyHtml = renderToStaticMarkup(
    <EnemySelection
      selection={selectEnemies(enemyInspection(battle), 'wolf', second.id, 'health')}
      onKind={noop}
      onStatus={noop}
      onOrder={noop}
      onSelect={noop}
    />,
  );
  expect(enemyHtml).toContain(`value="${second.id}" selected=""`);
  expect(enemyHtml).toContain('aria-label="逐只查看敌人"');
  expect(enemyHtml).toContain('role="status">第 1 / 2 只');
});

test('灵兽空交集与单只、敌人单只不显示多余按钮', () => {
  const { battle, boss } = setup();
  const allies = battleInspection(battle, [])!.allies;
  for (const status of ['alive', 'fallen'] as const) {
    const html = renderToStaticMarkup(
      <AllySelection
        selection={selectAllies(allies, 'scatter_bear', status, undefined)}
        onKind={noop}
        onStatus={noop}
        onSelect={noop}
      />,
    );
    expect(html).not.toContain('逐只查看灵兽');
  }
  const enemyHtml = renderToStaticMarkup(
    <EnemySelection
      selection={selectEnemies(enemyInspection(battle), 'boss', boss.id)}
      onKind={noop}
      onStatus={noop}
      onOrder={noop}
      onSelect={noop}
    />,
  );
  expect(enemyHtml).not.toContain('逐只查看敌人');
});
