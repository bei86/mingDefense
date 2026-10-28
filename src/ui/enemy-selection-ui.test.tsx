import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { EnemyInspection } from './EnemyInspection';
import { BattleInspection } from './BattleInspection';
import { enemyInspection } from './enemy-inspection';

const noop = () => {};

test('默认全部显示实际种类名称和计数、保留指定实例，渲染只读', () => {
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  spawnEnemy(session.battle!, 'boss', { x: 1, y: -2 });
  spawnEnemy(session.battle!, 'wolf', { x: 1, y: -2 });
  const chosen = spawnEnemy(session.battle!, 'wolf', { x: 2, y: -2 });
  spawnEnemy(session.battle!, 'summoned_wolf', { x: 3, y: -2 });
  spawnEnemy(session.battle!, 'summoner', { x: 4, y: -2 }).hp = 0;
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={enemyInspection(session.battle)}
      stageId={50}
      selectedId={chosen.id}
      onSelect={noop}
      onTarget={noop}
    />,
  );
  expect(html).toContain('aria-label="敌人种类"');
  expect(html).toContain('<option value="all" selected="">全部 · 4只</option>');
  expect(html).toContain('<option value="boss">镇渊妖君 · 1只</option>');
  expect(html).toContain('<option value="wolf">奔雷狼 · 2只</option>');
  expect(html).toContain('value="summoned_wolf"');
  expect(html).not.toContain('value="summoner"');
  expect(html).toContain(`value="${chosen.id}" selected=""`);
  expect(html).toContain('当前显示 4 / 4 只存活敌人');
  expect(html).toContain('后续敌袭');
  expect(JSON.stringify(session)).toBe(before);
});

test('预警快捷入口仍默认全部并精确选中第二只同名首领', () => {
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  spawnEnemy(session.battle!, 'boss', { x: 1, y: -2 });
  const boss = spawnEnemy(session.battle!, 'boss', { x: 3, y: -2 });
  spawnEnemy(session.battle!, 'summoned_wolf', { x: 2, y: -2 });
  session.battle!.warnings = [{ source: boss.id, row: 2, due: 1000 }];
  session.pause(true);
  const html = renderToStaticMarkup(
    <BattleInspection
      session={session}
      onClose={noop}
      onHandbook={noop}
      initialWarning={{ source: boss.id, row: 3, echo: false }}
    />,
  );
  expect(html).toContain('<option value="all" selected="">全部 · 3只</option>');
  expect(html).toContain(`value="${boss.id}" selected=""`);
  expect(html).toContain('预警定位 · 第3行 · 横扫');
  expect(html).toContain('open=""');
});

test.each([null, { enemies: [], initialId: undefined }])(
  '无活敌维持原空态，不显示无效筛选',
  (view) => {
    const html = renderToStaticMarkup(
      <EnemyInspection view={view} stageId={1} selectedId={99} onSelect={noop} onTarget={noop} />,
    );
    expect(html).toContain('当前场上没有存活敌人');
    expect(html).not.toContain('aria-label="敌人种类"');
  },
);
