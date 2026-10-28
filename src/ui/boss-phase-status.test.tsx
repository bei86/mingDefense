import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { bossDefinition, bossName, stages } from '../game/content';
import { spawnEnemy } from '../game/combat-skills';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { CombatStatus } from './CombatPanels';

test.each(stages.filter((stage) => stage.bossId).map((stage) => stage.id))(
  '第%s关首领门槛来自实际配置，阶段由真实旗标决定且显示只读',
  (stageId) => {
    const session = rosterPlaytest();
    session.preparation.stageId = stageId;
    session.start();
    const boss = spawnEnemy(session.battle!, 'boss', { x: 2.5, y: -2 });
    const threshold = bossDefinition(stageId).phase2HpPercent;
    // A low HP observation must not invent a phase transition.
    boss.hp = 1;
    boss.phase2 = false;
    const before = JSON.stringify(session);
    const first = renderToStaticMarkup(<CombatStatus session={session} />);
    expect(first).toContain(`第一阶段 · 生命≤${threshold}%进入第二阶段`);
    expect(first).toContain(`style="left:${threshold}%"`);
    expect(first).toContain(`aria-label="${bossName(stageId)}生命"`);
    expect(first).toContain('aria-valuenow="1"');
    expect(JSON.stringify(session)).toBe(before);
    // A restored phase flag remains authoritative even with high HP.
    boss.hp = boss.maxHp!;
    boss.phase2 = true;
    const secondBefore = JSON.stringify(session);
    const second = renderToStaticMarkup(<CombatStatus session={session} />);
    expect(second).toContain('第二阶段 · 怒意苏醒');
    expect(second).not.toContain('boss-phase-threshold');
    expect(second).not.toContain('进入第二阶段');
    expect(JSON.stringify(session)).toBe(secondBefore);
  },
);

test('没有首领或首领已倒下时隐藏整个阶段血条，普通怪不冒充首领', () => {
  const session = rosterPlaytest();
  session.start();
  spawnEnemy(session.battle!, 'wolf', { x: 1, y: 1 });
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain('combat-boss');
  const boss = spawnEnemy(session.battle!, 'boss', { x: 2, y: 1 });
  boss.hp = 0;
  boss.phase2 = true;
  expect(renderToStaticMarkup(<CombatStatus session={session} />)).not.toContain('combat-boss');
});
