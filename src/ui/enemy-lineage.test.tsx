import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { collectDeaths, spawnEnemy } from '../game/combat-skills';
import { updateBossPhase, updateSummoner } from '../game/enemy-abilities';
import { enemyInspection } from './enemy-inspection';
import { enemyLineage } from './enemy-lineage';
import { EnemyLineage, EnemyLineageList } from './EnemyLineage';
import { EnemyInspection } from './EnemyInspection';

const noop = () => {};
function setup(stageId = 50) {
  const battle = createCombat(
    [{ id: 100, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } }],
    { stageId },
  );
  battle.spawns = [];
  return battle;
}

test('按真实owner区分同名来源，只计直属存活，不含孙代或其他来源；读取只读', () => {
  const battle = setup();
  const first = spawnEnemy(battle, 'boss', { x: 1, y: 0 });
  const second = spawnEnemy(battle, 'boss', { x: 2, y: 0 });
  const child = spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, first.id);
  spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, first.id).hp = 0;
  const other = spawnEnemy(battle, 'summoned_wolf', { x: 2, y: 0 }, second.id);
  spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, child.id);
  child.hp = 12.1;
  battle.enemies.reverse();
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  const viewBefore = JSON.stringify(view);
  const model = enemyLineage(view, first.id)!;
  expect(model.children).toEqual([{ id: child.id, name: '咒影', hp: 13 }]);
  expect(model.source).toBeNull();
  expect(enemyLineage(view, second.id)!.children.map((x) => x.id)).toEqual([other.id]);
  const childModel = enemyLineage(view, child.id)!;
  expect(childModel.source).toMatchObject({ id: first.id, name: '镇渊妖君' });
  expect(childModel.origin).toBe(`镇渊妖君 #${first.id}`);
  model.children[0].hp = 99;
  expect(JSON.stringify(view)).toBe(viewBefore);
  expect(JSON.stringify(battle)).toBe(before);
});

test.each(['boss', 'summoner'] as const)('真实%s召唤生成的owner与名单、来源完全一致', (kind) => {
  const battle = setup();
  const parent = spawnEnemy(battle, kind, { x: 1, y: 0 });
  parent.nextSummon = 0;
  if (kind === 'boss') updateBossPhase(battle);
  else updateSummoner(battle, parent);
  const children = battle.enemies.filter((e) => e.owner === parent.id);
  expect(children.length).toBeGreaterThan(0);
  const view = enemyInspection(battle)!;
  const before = JSON.stringify(battle);
  expect(enemyLineage(view, parent.id)!.children.map((x) => x.id)).toEqual(
    children.map((x) => x.id),
  );
  for (const child of children) {
    expect(view.enemies.find((x) => x.id === child.id)!.ownerId).toBe(parent.id);
    expect(enemyLineage(view, child.id)!.source?.id).toBe(parent.id);
  }
  expect(JSON.stringify(battle)).toBe(before);
});

test('真实分裂后母体已退场，保留来源说明与编号而不提供无效跳转', () => {
  const battle = setup(9);
  const parent = spawnEnemy(battle, 'splitter', { x: 1, y: 0 });
  parent.hp = 0;
  collectDeaths(battle);
  const child = battle.enemies.find((x) => x.kind === 'split_fragment')!;
  expect(child).toBeDefined();
  const model = enemyLineage(enemyInspection(battle), child.id)!;
  expect(model.source).toBeNull();
  expect(model.origin).toBe(`#${parent.id}（来源已退场或未记录）`);
  const html = renderToStaticMarkup(<EnemyLineage model={model} onSelect={noop} />);
  expect(html).toContain('来源已退场或未记录');
  expect(html).not.toContain('查看来源敌人');
});

test('死亡来源排除、缺owner不推断；缺失或空实例返回null，编号0正确处理', () => {
  const battle = setup();
  const parent = spawnEnemy(battle, 'summoner', { x: 1, y: 0 });
  parent.id = 0;
  const child = spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, 0);
  expect(enemyLineage(enemyInspection(battle), child.id)!.source?.id).toBe(0);
  parent.hp = 0;
  expect(enemyLineage(enemyInspection(battle), child.id)!.source).toBeNull();
  delete child.owner;
  const legacy = enemyLineage(enemyInspection(battle), child.id)!;
  expect(legacy).toEqual({ origin: null, source: null, children: [] });
  expect(enemyLineage(enemyInspection(battle), parent.id)).toBeNull();
  expect(enemyLineage(enemyInspection(battle), 999)).toBeNull();
  expect(enemyLineage(null, child.id)).toBeNull();
});

test('默认名单折叠，展开逐只保留编号/生命及目标按钮；空名单不显示空折叠', () => {
  const battle = setup();
  const parent = spawnEnemy(battle, 'summoner', { x: 1, y: 0 });
  const first = spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, parent.id);
  const second = spawnEnemy(battle, 'summoned_wolf', { x: 2, y: 0 }, parent.id);
  const model = enemyLineage(enemyInspection(battle), parent.id)!;
  const closed = renderToStaticMarkup(<EnemyLineage model={model} onSelect={noop} />);
  expect(closed).toContain('直属存活衍生 · 2只');
  expect(closed).not.toContain('open=""');
  expect(closed).not.toContain('aria-label="直属存活衍生名单"');
  const list = renderToStaticMarkup(<EnemyLineageList enemies={model.children} onSelect={noop} />);
  for (const child of [first, second]) {
    expect(list).toContain(`aria-label="查看衍生敌人：咒影，编号${child.id}，生命${child.hp}"`);
  }
  expect(list).toContain('直属存活衍生名单');
  const childHtml = renderToStaticMarkup(
    <EnemyLineage model={enemyLineage(enemyInspection(battle), first.id)!} onSelect={noop} />,
  );
  expect(childHtml).toContain(`aria-label="查看来源敌人：鸣咒犬，编号${parent.id}"`);
  expect(childHtml).not.toContain('<details');
});

test('详情接入准确来源与独立计数，渲染不改完整战斗或投影', () => {
  const battle = setup();
  const parent = spawnEnemy(battle, 'boss', { x: 1, y: 0 });
  const child = spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, parent.id);
  const view = enemyInspection(battle)!;
  const before = JSON.stringify({ battle, view });
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={view}
      stageId={50}
      selectedId={child.id}
      onSelect={noop}
      onTarget={noop}
    />,
  );
  expect(html).toContain(`aria-label="查看来源敌人：镇渊妖君，编号${parent.id}"`);
  expect(html).toContain('直属存活衍生');
  expect(JSON.stringify({ battle, view })).toBe(before);
});
