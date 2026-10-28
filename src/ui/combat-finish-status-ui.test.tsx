import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { CombatStatus } from './CombatPanels';

test('出完后HUD显示活敌数，暂停与择取天赋保留；渲染不修改Session', () => {
  const session = rosterPlaytest();
  session.start();
  session.battle!.spawnIndex = session.battle!.spawns.length;
  spawnEnemy(session.battle!, 'summoned_wolf', { x: 1, y: -2 });
  for (const mode of ['running', 'paused', 'choosing']) {
    if (mode === 'paused') session.pause(true);
    if (mode === 'choosing') {
      session.pause(false);
      session.battle!.choices = ['attack_speed'];
    }
    const before = JSON.stringify(session);
    const html = renderToStaticMarkup(<CombatStatus session={session} />);
    expect(html).toContain('<p class="combat-finish-status">固定敌袭已出完 · 场上 1 只</p>');
    expect(JSON.stringify(session)).toBe(before);
  }
});

test('未出完不渲染；胜败及整备阶段隐藏，battle结果先于Session阶段变化也隐藏', () => {
  const session = rosterPlaytest();
  session.start();
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain(
    'combat-finish-status',
  );
  session.battle!.spawnIndex = session.battle!.spawns.length;
  for (const phase of ['prepare', 'victory', 'defeat'] as const) {
    session.phase = phase;
    expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain(
      'combat-finish-status',
    );
  }
  session.phase = 'combat';
  for (const result of ['victory', 'defeat'] as const) {
    session.battle!.result = result;
    expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain(
      'combat-finish-status',
    );
  }
});

test('HUD接通招式结算与等待判定文案，不提前显示已胜利', () => {
  const session = rosterPlaytest();
  session.start();
  session.battle!.spawnIndex = session.battle!.spawns.length;
  session.battle!.warnings.push({ source: 100, row: 1, due: 1000 });
  const html = renderToStaticMarkup(<CombatStatus session={session} />);
  expect(html).toContain('固定敌袭已出完 · 招式结算中');
  session.battle!.warnings = [];
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).toContain('等待战果判定');
  expect(session.battle!.result).toBeNull();
});
