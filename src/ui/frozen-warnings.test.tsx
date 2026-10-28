import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { config } from '../game/content';
import { enemyInspection } from './enemy-inspection';
import { EnemyWarnings } from './EnemyWarnings';

const noop = () => {};
function setup() {
  const battle = createCombat(
    [{ id: 0, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 3 } }],
    { stageId: 50 },
  );
  battle.spawns = [];
  battle.allies[0].hp = battle.allies[0].maxHp = 1e6;
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: -2 });
  boss.nextCleave = 0;
  boss.cooldown = boss.nextSummon = 1e8;
  return { battle, boss };
}

test('真实横扫/回响冻结多tick准备保持，冻结时间下降，解冻恢复并实际释放', () => {
  const { battle, boss } = setup();
  stepCombat(battle);
  boss.nextCleave = 1e8;
  const initial = enemyInspection(battle)!.enemies[0].warnings;
  expect(initial.map((w) => w.echo)).toEqual([false, true]);
  expect(initial.map((w) => w.frozenMs)).toEqual([0, 0]);
  boss.frozenUntil = battle.time + 3 * config.runtime.tickMs;
  for (let i = 1; i <= 3; i++) {
    stepCombat(battle);
    const warnings = enemyInspection(battle)!.enemies[0].warnings;
    expect(warnings.map((w) => w.remainingMs)).toEqual(initial.map((w) => w.remainingMs));
    expect(warnings.map((w) => w.frozenMs)).toEqual(
      [1, 1].map(() => (3 - i) * config.runtime.tickMs),
    );
  }
  stepCombat(battle);
  expect(enemyInspection(battle)!.enemies[0].warnings[0].remainingMs).toBe(
    initial[0].remainingMs - config.runtime.tickMs,
  );
  for (let i = 0; i < 100 && battle.warnings.length; i++) stepCombat(battle);
  expect(battle.warnings).toEqual([]);
  expect(battle.damageTaken).toBeGreaterThan(0);
});

test('冻结到期/1ms/准备为0准确显示，渲染不修改Combat或行内名单与定位', () => {
  const { battle, boss } = setup();
  battle.time = 100;
  battle.warnings = [
    { source: boss.id, row: 3, due: 100 },
    { source: boss.id, row: 3, due: 101, echo: true },
  ];
  boss.frozenUntil = 101;
  const before = JSON.stringify(battle);
  const warnings = enemyInspection(battle)!.enemies[0].warnings;
  expect(warnings.map((w) => [w.remainingMs, w.frozenMs])).toEqual([
    [0, 1],
    [1, 1],
  ]);
  const html = renderToStaticMarkup(
    <EnemyWarnings
      warnings={warnings}
      onSelect={noop}
      initialWarning={{ source: boss.id, row: 4, echo: true }}
    />,
  );
  expect(html).toContain('待解冻');
  expect(html).toContain('解冻后准备 0.1 秒');
  expect(html.match(/冻结剩余 0.1 秒/g)).toHaveLength(2);
  expect(html).not.toContain('待释放');
  expect(html).toContain('查看预警行内灵兽：灵金桃6阶，编号0，2列4行起');
  expect(html.match(/open=""/g)).toHaveLength(1);
  expect(JSON.stringify(battle)).toBe(before);
  boss.frozenUntil = battle.time;
  const thawed = renderToStaticMarkup(
    <EnemyWarnings warnings={enemyInspection(battle)!.enemies[0].warnings} onSelect={noop} />,
  );
  expect(thawed).toContain('待释放');
  expect(thawed).toContain('剩余 0.1 秒');
  expect(thawed).not.toContain('待解冻');
  expect(thawed).not.toContain('冻结剩余');
});

test('同名首领按来源分别冻结，普通来源不套用首领时钟，死亡/缺失来源不出现', () => {
  const { battle, boss } = setup();
  const other = spawnEnemy(battle, 'boss', { x: 2, y: -2 });
  const wolf = spawnEnemy(battle, 'wolf', { x: 1, y: -2 });
  boss.frozenUntil = 1000;
  wolf.frozenUntil = 2000;
  battle.warnings = [boss.id, other.id, wolf.id, 999].map((source) => ({
    source,
    row: 3,
    due: 500,
  }));
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  expect(view.enemies.find((e) => e.id === boss.id)!.warnings[0].frozenMs).toBe(1000);
  expect(view.enemies.find((e) => e.id === other.id)!.warnings[0].frozenMs).toBe(0);
  expect(view.enemies.find((e) => e.id === wolf.id)!.warnings[0].frozenMs).toBe(0);
  expect(view.enemies.flatMap((e) => e.warnings)).toHaveLength(3);
  expect(JSON.stringify(battle)).toBe(before);
  boss.hp = 0;
  expect(enemyInspection(battle)!.enemies.some((e) => e.id === boss.id)).toBe(false);
  battle.enemies = [];
  expect(enemyInspection(battle)!.enemies).toEqual([]);
});
