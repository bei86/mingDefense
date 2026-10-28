import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { bossName, enemyAppearances, type EnemyKind } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { enemyInspection } from './enemy-inspection';
import { selectEnemies } from './enemy-selection';

function setup() {
  const battle = createCombat([], { stageId: 50 });
  const kinds: EnemyKind[] = [
    'wolf',
    'summoned_wolf',
    'wolf',
    'splitter',
    'split_fragment',
    'summoner',
    'runner',
    'croc',
    'ranged',
    'boss',
  ];
  for (const kind of kinds) spawnEnemy(battle, kind, { x: 1, y: -2 });
  spawnEnemy(battle, 'boss', { x: 1, y: -2 }).hp = 0;
  spawnEnemy(battle, 'summoned_wolf', { x: 1, y: -2 }).hp = -1;
  return { battle, view: enemyInspection(battle)! };
}

test('全部计数守恒、九类分开，死亡不计，沿用首领优先/编号顺序与实际名称且只读', () => {
  const { battle, view } = setup();
  const before = JSON.stringify({ battle, view });
  const selection = selectEnemies(view, 'all', undefined);
  expect(selection.total).toBe(10);
  expect(selection.kinds).toHaveLength(9);
  expect(selection.kinds[0]).toEqual({ kind: 'boss', name: bossName(50), count: 1 });
  expect(selection.kinds.reduce((n, kind) => n + kind.count, 0)).toBe(selection.total);
  expect(selection.kinds.find((kind) => kind.kind === 'wolf')).toMatchObject({ count: 2 });
  for (const group of selection.kinds) {
    expect(group.name).toBe(
      group.kind === 'boss' ? bossName(50) : enemyAppearances[group.kind].name,
    );
  }
  expect(selection.enemies.map((enemy) => enemy.id)).toEqual(view.enemies.map((enemy) => enemy.id));
  expect(selection.selectedId).toBe(view.initialId);
  expect(JSON.stringify({ battle, view })).toBe(before);
});

test('切换类别保留匹配实例，否则切首个；全部恢复仍保留当前实例', () => {
  const { view } = setup();
  const wolves = view.enemies.filter((enemy) => enemy.kind === 'wolf');
  const selected = selectEnemies(view, 'wolf', wolves[1].id);
  expect(selected.kind).toBe('wolf');
  expect(selected.enemies.map((enemy) => enemy.id)).toEqual(wolves.map((enemy) => enemy.id));
  expect(selected.selectedId).toBe(wolves[1].id);
  expect(selected.total).toBe(10);
  const other = selectEnemies(view, 'split_fragment', selected.selectedId);
  expect(other.enemies).toHaveLength(1);
  expect(other.selectedId).toBe(view.enemies.find((enemy) => enemy.kind === 'split_fragment')!.id);
  expect(selectEnemies(view, 'all', other.selectedId).selectedId).toBe(other.selectedId);
});

test('失效编号回退到当前结果首个，类别消失回到全部并保留仍有效的选择', () => {
  const { view } = setup();
  expect(selectEnemies(view, 'wolf', 999).selectedId).toBe(
    view.enemies.find((enemy) => enemy.kind === 'wolf')!.id,
  );
  const missing = { ...view, enemies: view.enemies.filter((enemy) => enemy.kind !== 'summoner') };
  const last = missing.enemies.at(-1)!.id;
  expect(selectEnemies(missing, 'summoner', last)).toMatchObject({ kind: 'all', selectedId: last });
  expect(selectEnemies(missing, 'summoner', 999).selectedId).toBe(missing.enemies[0].id);
});

test('无战斗或空列表均返回空选择，旧kind由原投影按狼处理', () => {
  for (const view of [null, { enemies: [], initialId: undefined }]) {
    expect(selectEnemies(view, 'boss', 1)).toEqual({
      kinds: [],
      kind: 'all',
      enemies: [],
      selectedId: undefined,
      total: 0,
    });
  }
  const battle = createCombat([]);
  spawnEnemy(battle, 'wolf', { x: 1, y: -2 }).kind = undefined;
  expect(selectEnemies(enemyInspection(battle), 'wolf', undefined).kinds).toEqual([
    { kind: 'wolf', name: enemyAppearances.wolf.name, count: 1 },
  ]);
});

test('暂停读取所有种类不改变完整Session与投影，tick不推进', () => {
  const session = rosterPlaytest();
  session.start();
  spawnEnemy(session.battle!, 'wolf', { x: 1, y: -2 });
  spawnEnemy(session.battle!, 'summoner', { x: 2, y: -2 });
  session.held = true;
  session.pause(true);
  const view = enemyInspection(session.battle)!;
  const before = JSON.stringify({ session, view });
  for (const kind of ['all', 'wolf', 'summoner', 'boss'] as const) {
    selectEnemies(view, kind, view.initialId);
  }
  session.tick();
  expect(JSON.stringify({ session, view })).toBe(before);
});
