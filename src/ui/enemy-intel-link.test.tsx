import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { bossName, enemyAppearances, type EnemyKind } from '../game/content';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import { StageIntel } from './StageIntel';
import { stageIntel } from './stage-intel';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { spawnEnemy } from '../game/combat-skills';
import { EnemyInspection } from './EnemyInspection';
import { BattleInspection } from './BattleInspection';
import { enemyInspection } from './enemy-inspection';

const noop = () => {};

test('详情入口包含当前敌名，无回调或无活敌不显示，渲染只读', () => {
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  const first = spawnEnemy(session.battle!, 'wolf', { x: 1, y: -2 });
  const selected = spawnEnemy(session.battle!, 'boss', { x: 3, y: -2 });
  selected.hp = 1;
  session.pause(true);
  const view = enemyInspection(session.battle);
  const before = JSON.stringify(session);
  function render(selectedId: number, withLink = true) {
    return renderToStaticMarkup(
      <EnemyInspection
        view={view}
        stageId={50}
        selectedId={selectedId}
        onSelect={noop}
        onTarget={noop}
        onIntel={withLink ? noop : undefined}
      />,
    );
  }
  expect(render(selected.id)).toContain('aria-label="查看镇渊妖君敌情档案"');
  expect(render(first.id)).toContain('aria-label="查看奔雷狼敌情档案"');
  expect(render(selected.id, false)).not.toContain('查看敌情档案 ›');
  const empty = renderToStaticMarkup(
    <EnemyInspection
      view={null}
      stageId={50}
      selectedId={undefined}
      onSelect={noop}
      onTarget={noop}
      onIntel={noop}
    />,
  );
  expect(empty).not.toContain('查看敌情档案 ›');
  expect(JSON.stringify(session)).toBe(before);
});

test('战场详情透传敌情入口并支持隐藏保留，暂停数据不变', () => {
  const session = rosterPlaytest();
  session.start();
  const boss = spawnEnemy(session.battle!, 'boss', { x: 3, y: -2 });
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BattleInspection
      session={session}
      onClose={noop}
      onHandbook={noop}
      onIntel={noop}
      suspended
      initialWarning={{ source: boss.id, row: 1, echo: false }}
    />,
  );
  expect(html).toContain('class="modal-backdrop top-modal" hidden=""');
  expect(html).toContain('查看敌情档案 ›');
  expect(JSON.stringify(session)).toBe(before);
});

test.each<[number, EnemyKind]>([
  [50, 'boss'],
  [50, 'wolf'],
  [50, 'summoned_wolf'],
  [9, 'split_fragment'],
])('第%s关%s快捷档案置前且只显示一次，不改变配置投影', (stageId, kind) => {
  const before = JSON.stringify(stageIntel(stageId));
  const html = renderToStaticMarkup(
    <StageIntel
      currentStageId={stageId}
      initialEnemyKind={kind}
      closeLabel="返回战场详情"
      onClose={noop}
    />,
  );
  const name = kind === 'boss' ? bossName(stageId) : enemyAppearances[kind].name;
  expect(html).toContain('aria-label="快捷敌情档案"');
  expect(html).toContain(`第${stageId}关 · 所选敌情档案`);
  expect(html.indexOf(`<h4>${name}</h4>`)).toBeLessThan(html.indexOf('aria-label="浏览关卡"'));
  expect(html.split(`<h4>${name}</h4>`)).toHaveLength(2);
  expect(html).toContain('本关配置基础值');
  expect(html).toContain('当前生命与状态见战场详情');
  expect(html).toContain('返回战场详情');
  expect(JSON.stringify(stageIntel(stageId))).toBe(before);
});

test('当前候选队列的目标固定数沿用真实排程，读取不改Session或队列', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  const before = JSON.stringify(trial);
  const html = renderToStaticMarkup(
    <StageIntel
      currentStageId={8}
      currentSpawns={trial.spawns}
      initialEnemyKind="ranged"
      onClose={noop}
    />,
  );
  const target = html.split('aria-label="快捷敌情档案"')[1].split('</section>')[0];
  expect(target).toContain('翎羽客');
  expect(target).toContain('固定 9 只');
  expect(target).not.toContain('固定 12 只');
  expect(JSON.stringify(trial)).toBe(before);
});

test('空队列找不到目标时明确缺失，不回退成别的敌人或补造首领', () => {
  const html = renderToStaticMarkup(
    <StageIntel currentStageId={50} currentSpawns={[]} initialEnemyKind="boss" onClose={noop} />,
  );
  expect(html).toContain('该种类未列入本关固定队列与衍生档案');
  expect(html).not.toContain('<h4>镇渊妖君</h4>');
  expect(html).toContain('固定出场 0 只');
});

test('普通入口布局和关闭文案保持；目标关预览使用目标关正常配置', () => {
  const plain = renderToStaticMarkup(<StageIntel currentStageId={8} onClose={noop} />);
  expect(plain).not.toContain('快捷敌情档案');
  expect(plain).toContain('收起敌情手册');
  const html = renderToStaticMarkup(
    <StageIntel
      currentStageId={8}
      currentSpawns={[]}
      initialStageId={50}
      initialEnemyKind="boss"
      onClose={noop}
    />,
  );
  expect(html).toContain('第50关 · 所选敌情档案');
  expect(html).toContain('<h4>镇渊妖君</h4>');
  expect(html).toContain('固定出场 11 只');
});
