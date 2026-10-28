import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { BattleInspection } from './BattleInspection';
import { CombatStatus } from './CombatPanels';
import { EnemyInspection } from './EnemyInspection';
import { enemyInspection } from './enemy-inspection';
import type { BossWarningTarget } from './boss-warnings';

const noop = () => {};
function setup() {
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  const battle = session.battle!;
  const first = spawnEnemy(battle, 'boss', { x: 1, y: -2 });
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: -2 });
  battle.warnings = [
    { source: first.id, row: 0, due: 900 },
    { source: boss.id, row: 3, due: 1000 },
    { source: boss.id, row: 3, due: 2000, echo: true },
  ];
  session.pause(true);
  return { session, battle, boss };
}

test.each([false, true])(
  '精确定位第二只同名首领的echo=%s预警，仅该名单默认展开，渲染只读',
  (echo) => {
    const { session, boss } = setup();
    const before = JSON.stringify(session);
    const html = renderToStaticMarkup(
      <BattleInspection
        session={session}
        onClose={noop}
        onHandbook={noop}
        initialWarning={{ source: boss.id, row: 4, echo }}
      />,
    );
    expect(html).toContain('<button aria-pressed="true">敌人</button>');
    expect(html).toContain(`<option value="${boss.id}" selected=""`);
    expect(html).toContain(`预警定位 · 第4行 · ${echo ? '追击' : '横扫'}`);
    expect(html).toContain('第4行横扫预警行内灵兽');
    expect(html).toContain('第4行回响预警行内灵兽');
    expect(html.match(/open=""/g)).toHaveLength(1);
    const entries = html.split('class="inspection-warning-entry"').slice(1);
    expect(entries[echo ? 1 : 0]).toContain('open=""');
    expect(entries[echo ? 0 : 1]).not.toContain('open=""');
    expect(html.indexOf('预警定位')).toBeLessThan(html.indexOf('inspection-profile'));
    expect(html).toContain('返回暂停菜单');
    expect(JSON.stringify(session)).toBe(before);
  },
);

test('普通菜单默认灵兽，不残留旧预警；普通敌人页名单仍收起', () => {
  const { session, battle, boss } = setup();
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} />,
  );
  expect(html).toContain('<button aria-pressed="true">灵兽</button>');
  expect(html).not.toContain('预警定位');
  const enemy = renderToStaticMarkup(
    <EnemyInspection
      view={enemyInspection(battle)}
      stageId={50}
      selectedId={boss.id}
      onSelect={noop}
      onTarget={noop}
    />,
  );
  expect(enemy).not.toContain('open=""');
  expect(enemy).not.toContain('预警定位');
});

test('切换到其他来源不显示原预警定位或展开其同排名单', () => {
  const { battle, boss } = setup();
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={enemyInspection(battle)}
      stageId={50}
      selectedId={battle.enemies[0].id}
      onSelect={noop}
      onTarget={noop}
      initialWarning={{ source: boss.id, row: 1, echo: false }}
    />,
  );
  expect(html).not.toContain('预警定位');
  expect(html).not.toContain('open=""');
});

test('HUD有回调提供可键盘操作的行入口，没有回调保留摘要；最多两条', () => {
  const { session } = setup();
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(<CombatStatus session={session} onInspectWarning={noop} />);
  expect(html).toContain('type="button" class="boss-warning-inspect"');
  expect(html).toContain('aria-label="暂停查看第1行横扫预警"');
  expect(html).toContain('aria-label="暂停查看第4行横扫预警"');
  expect(html.match(/暂停查看 ›/g)).toHaveLength(2);
  expect(html).toContain('另有1道预警');
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain('暂停查看');
  expect(JSON.stringify(session)).toBe(before);
});

test('追击入口名称和冻结提示并存，倒下来源无快捷入口', () => {
  const { session, battle, boss } = setup();
  battle.warnings = battle.warnings.filter((warning) => warning.echo);
  boss.frozenUntil = battle.time + 500;
  const html = renderToStaticMarkup(<CombatStatus session={session} onInspectWarning={noop} />);
  expect(html).toContain('aria-label="暂停查看第4行追击预警"');
  expect(html).toContain('冻结中 · 释放延后');
  boss.hp = 0;
  expect(
    renderToStaticMarkup(<CombatStatus session={session} onInspectWarning={noop} />),
  ).not.toContain('暂停查看');
});

test('所点预警没有存活波及者时明确说明，不展开无关名单', () => {
  const { session, battle, boss } = setup();
  battle.allies.forEach((ally) => {
    ally.hp = 0;
  });
  const target: BossWarningTarget = { source: boss.id, row: 4, echo: true };
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} initialWarning={target} />,
  );
  expect(html).toContain('预警定位 · 第4行 · 追击');
  expect(html).toContain('当前该行没有存活灵兽');
  expect(html).not.toContain('open=""');
});
