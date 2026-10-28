import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { BossWarnings } from './BossWarnings';
import { CombatStatus } from './CombatPanels';

function setup() {
  const session = rosterPlaytest();
  session.preparation.stageId = 40;
  session.start();
  const battle = session.battle!;
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: -2 });
  battle.time = 1000;
  return { session, battle, boss };
}

test('无真实预警不占位，来源倒下后隐藏', () => {
  expect(renderToStaticMarkup(<BossWarnings battle={null} />)).toBe('');
  const { battle, boss } = setup();
  expect(renderToStaticMarkup(<BossWarnings battle={battle} />)).toBe('');
  battle.warnings = [{ source: boss.id, row: 0, due: 2000 }];
  boss.hp = 0;
  expect(renderToStaticMarkup(<BossWarnings battle={battle} />)).toBe('');
});

test('首段及同一行追击分列，向上取整时间，使用分组且不逐帧播报', () => {
  const { battle, boss } = setup();
  battle.warnings = [
    { source: boss.id, row: 3, due: 1101 },
    { source: boss.id, row: 3, due: 2000, echo: true },
  ];
  const html = renderToStaticMarkup(<BossWarnings battle={battle} />);
  expect(html).toContain('横扫 · 第4行');
  expect(html).toContain('追击 · 第4行');
  expect(html).toContain('约0.2秒后判定');
  expect(html).toContain('约1秒后判定');
  expect(html).toContain('role="group" aria-label="首领横扫预警"');
  expect(html).toContain('游戏内时间 · 释放时重新判定');
  expect(html).not.toContain('aria-live');
});

test('到期待判定，冻结状态优先于已到期或正剩余时间', () => {
  const { battle, boss } = setup();
  battle.warnings = [
    { source: boss.id, row: 0, due: 900 },
    { source: boss.id, row: 1, due: 2000, echo: true },
  ];
  expect(renderToStaticMarkup(<BossWarnings battle={battle} />)).toContain('待判定');
  boss.frozenUntil = 1001;
  const html = renderToStaticMarkup(<BossWarnings battle={battle} />);
  expect(html.match(/冻结中 · 释放延后/g)).toHaveLength(2);
  expect(html).not.toContain('秒后判定');
  expect(html).not.toContain('待判定');
});

test('只显示最早两条，并明确显示额外条数', () => {
  const { battle, boss } = setup();
  battle.warnings = [3, 2, 1, 0].map((row) => ({ source: boss.id, row, due: 2000 + row * 100 }));
  const html = renderToStaticMarkup(<BossWarnings battle={battle} />);
  expect(html.match(/<li/g)).toHaveLength(2);
  expect(html).toContain('第1行');
  expect(html).toContain('第2行');
  expect(html).not.toContain('第3行');
  expect(html).not.toContain('第4行');
  expect(html).toContain('另有2道预警');
});

test('CombatStatus实际接线，暂停渲染保持只读，退场隐藏', () => {
  const { session, battle, boss } = setup();
  battle.warnings = [{ source: boss.id, row: 5, due: 2101 }];
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(<CombatStatus session={session} />);
  expect(html).toContain('首领横扫预警');
  expect(html).toContain('横扫 · 第6行');
  expect(html).toContain('约1.2秒后判定');
  expect(JSON.stringify(session)).toBe(before);
  battle.enemies = [];
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain('首领横扫预警');
});
