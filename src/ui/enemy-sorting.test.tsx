import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { enemyInspection } from './enemy-inspection';
import { selectEnemies } from './enemy-selection';
import { enemySortLabel, sortEnemies } from './enemy-sorting';
import { EnemySelection } from './EnemySelection';

const noop = () => {};
function setup() {
  const battle = createCombat(
    [{ id: 100, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } }],
    { stageId: 50 },
  );
  const first = spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: 0 });
  const second = spawnEnemy(battle, 'wolf', { x: 2, y: 0 });
  Object.assign(first, { hp: 20, maxHp: 100 });
  Object.assign(boss, { hp: 100, maxHp: 10000 });
  Object.assign(second, { hp: 10, maxHp: 20 });
  spawnEnemy(battle, 'wolf', { x: 4, y: 0 }).hp = 0;
  battle.enemies.reverse();
  return { battle, first, boss, second };
}

test('默认首领优先、其余编号递增，真实投影与Combat全JSON只读，返回副本', () => {
  const { battle, first, boss, second } = setup();
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  const projected = JSON.stringify(view);
  const sorted = sortEnemies(view.enemies, 'default');
  expect(sorted.map((e) => e.id)).toEqual([boss.id, first.id, second.id]);
  expect(sorted).not.toBe(view.enemies);
  sortEnemies(view.enemies, 'health');
  sortEnemies(view.enemies, 'hp');
  expect(JSON.stringify(view)).toBe(projected);
  expect(JSON.stringify(battle)).toBe(before);
});

test('当前生命与生命比例顺序不同，非默认不额外提前首领，同值按编号', () => {
  const { battle, first, boss, second } = setup();
  const view = enemyInspection(battle)!;
  expect(sortEnemies(view.enemies, 'hp').map((e) => e.id)).toEqual([second.id, first.id, boss.id]);
  expect(sortEnemies(view.enemies, 'health').map((e) => e.id)).toEqual([
    boss.id,
    first.id,
    second.id,
  ]);
  const tied = view.enemies.map((e) => ({ ...e, hp: 1, maxHp: 100 }));
  for (const order of ['health', 'hp'] as const) {
    expect(sortEnemies(tied, order).map((e) => e.id)).toEqual([first.id, boss.id, second.id]);
  }
});

test('旧上限未记录排有效比例之后，不当成0，当前生命仍可排序', () => {
  const { battle, first, boss, second } = setup();
  first.maxHp = undefined;
  second.maxHp = 0;
  const view = enemyInspection(battle)!;
  expect(sortEnemies(view.enemies, 'health').map((e) => e.id)).toEqual([
    boss.id,
    first.id,
    second.id,
  ]);
  expect(sortEnemies(view.enemies, 'hp').map((e) => e.id)).toEqual([second.id, first.id, boss.id]);
  expect(view.enemies.map((e) => enemySortLabel(e, 'health'))).toEqual([
    '比例 1%',
    '比例 未记录',
    '比例 未记录',
  ]);
});

test('非有限/无效指标排末，同缺失按编号，空数组安全', () => {
  const { battle, first, boss, second } = setup();
  const view = enemyInspection(battle)!;
  view.enemies.find((e) => e.id === first.id)!.hp = NaN;
  view.enemies.find((e) => e.id === second.id)!.hp = Infinity;
  for (const order of ['health', 'hp'] as const) {
    expect(sortEnemies(view.enemies, order).map((e) => e.id)).toEqual([
      boss.id,
      first.id,
      second.id,
    ]);
  }
  for (const maxHp of [null, 0, -1, Infinity, NaN]) {
    const enemy = { ...view.enemies[0], maxHp };
    expect(enemySortLabel(enemy, 'health')).toBe('比例 未记录');
  }
  expect(sortEnemies([], 'health')).toEqual([]);
});

test('比例沿用详情向上取整生命，最多一位小数，不影响默认和绝对生命文案', () => {
  const { battle, first } = setup();
  first.hp = 12.1;
  const enemy = enemyInspection(battle)!.enemies.find((e) => e.id === first.id)!;
  expect(enemy.hp).toBe(13);
  expect(enemySortLabel(enemy, 'health')).toBe('比例 13%');
  expect(enemySortLabel({ ...enemy, hp: 1, maxHp: 3 }, 'health')).toBe('比例 33.3%');
  expect(enemySortLabel(enemy, 'default')).toBe('');
  expect(enemySortLabel(enemy, 'hp')).toBe('');
});

test('排序保留具体编号，种类失配按当前排序首只；统计、默认与空投影兼容', () => {
  const { battle, first, boss, second } = setup();
  const view = enemyInspection(battle)!;
  expect(selectEnemies(view, 'all', first.id, 'hp').selectedId).toBe(first.id);
  const selected = selectEnemies(view, 'wolf', boss.id, 'hp');
  expect(selected).toMatchObject({ kind: 'wolf', order: 'hp', selectedId: second.id, total: 3 });
  expect(selected.kinds.map((e) => [e.kind, e.count])).toEqual([
    ['boss', 1],
    ['wolf', 2],
  ]);
  expect(selected.enemies.map((e) => e.id)).toEqual([second.id, first.id]);
  expect(selectEnemies(view, 'all', 999, 'hp').selectedId).toBe(second.id);
  expect(selectEnemies(view, 'summoner', 999, 'hp').kind).toBe('all');
  expect(selectEnemies(view, 'all', undefined).selectedId).toBe(boss.id);
  expect(selectEnemies(null, 'all', undefined, 'health')).toMatchObject({
    order: 'health',
    enemies: [],
    selectedId: undefined,
    total: 0,
  });
});

test('受控控件显示排序、具体编号及旧比例记录，默认保持原实例文案', () => {
  const { battle, first, second } = setup();
  first.maxHp = undefined;
  const view = enemyInspection(battle)!;
  function render(order: 'default' | 'hp' | 'health') {
    return renderToStaticMarkup(
      <EnemySelection
        selection={selectEnemies(view, 'all', second.id, order)}
        onKind={noop}
        onStatus={noop}
        onOrder={noop}
        onSelect={noop}
      />,
    );
  }
  const health = render('health');
  expect(health).toContain('aria-label="敌人排序"');
  expect(health).toContain('<option value="health" selected="">生命比例 · 从低到高</option>');
  expect(health).toContain('比例 未记录');
  expect(health).toContain('比例 50%');
  expect(health).toContain(`value="${second.id}" selected=""`);
  expect(health).toContain('按详情所示生命与上限计算');
  expect(render('default')).not.toContain('比例 未记录');
  expect(render('hp')).toContain('当前生命 · 从低到高');
});
