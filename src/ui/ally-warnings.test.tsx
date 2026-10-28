import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { config } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { allyWarnings } from './ally-warnings';
import { AllyWarnings, AllyWarningsList } from './AllyWarnings';
import { BattleInspection } from './BattleInspection';
import { enemyInspection } from './enemy-inspection';

const noop = () => {};
function setup() {
  const battle = createCombat(
    [
      { id: 0, kind: 'boar', rank: 2, position: { x: 0, y: 2 } },
      { id: 10, kind: 'ice_fish', rank: 2, position: { x: 2, y: 1 } },
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 5, y: 4 } },
      { id: 12, kind: 'boar', rank: 1, position: null },
    ],
    { stageId: 50 },
  );
  battle.spawns = [];
  for (const ally of battle.allies) {
    ally.hp = ally.maxHp = 1e6;
    ally.cooldown = 1e8;
  }
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: -2 });
  boss.nextCleave = 0;
  boss.cooldown = boss.nextSummon = 1e8;
  return { battle, boss };
}

test('真实双段横扫按当前完整占格反查，冻结不流逝准备，解冻最终释放造成承伤', () => {
  const { battle, boss } = setup();
  stepCombat(battle);
  boss.nextCleave = 1e8;
  const warnings = allyWarnings(enemyInspection(battle), 10);
  expect(warnings.map((warning) => [warning.row, warning.echo])).toEqual([
    [2, false],
    [2, true],
  ]);
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
  boss.frozenUntil = battle.time + 3 * config.runtime.tickMs;
  for (let tick = 1; tick <= 3; tick++) {
    stepCombat(battle);
    expect(allyWarnings(enemyInspection(battle), 10)).toEqual(
      warnings.map((warning) => ({
        ...warning,
        frozenMs: (3 - tick) * config.runtime.tickMs,
      })),
    );
  }
  const hp = battle.allies.map((ally) => ally.hp);
  for (let tick = 0; tick < 100 && battle.warnings.length; tick++) stepCombat(battle);
  expect(allyWarnings(enemyInspection(battle), 10)).toEqual([]);
  expect(battle.allies[1].hp).toBeLessThan(hp[1]);
  expect(battle.allies[0].hp).toBe(hp[0]);
  expect(battle.allies[2].hp).toBe(hp[2]);
});

test('跨行多格每条只计一次，主段/回响及同名来源独立，编号0与排序不依赖释放顺序', () => {
  const { battle, boss } = setup();
  boss.id = 0;
  const other = spawnEnemy(battle, 'boss', { x: 1, y: -2 });
  battle.time = 100;
  battle.warnings = [
    { source: other.id, row: 1, due: 50 },
    { source: boss.id, row: 2, due: 400, echo: true },
    { source: boss.id, row: 1, due: 500 },
    { source: boss.id, row: 2, due: 200 },
  ];
  boss.target = 11;
  const view = enemyInspection(battle)!;
  const before = JSON.stringify({ battle, view });
  const warnings = allyWarnings(view, 10);
  expect(warnings.map((w) => [w.source.id, w.row, w.echo, w.remainingMs])).toEqual([
    [0, 2, false, 400],
    [0, 3, false, 100],
    [0, 3, true, 300],
    [other.id, 2, false, 0],
  ]);
  expect(allyWarnings(view, 0)).toHaveLength(2);
  expect(allyWarnings(view, 11)).toEqual([]);
  warnings[0].source.name = 'changed';
  expect(warnings[1].source.name).toBe('镇渊妖君');
  expect(JSON.stringify({ battle, view })).toBe(before);
});

test('只含已生成首领预警，不用普攻或锁定推测，倒下/退场/缺失和备战对象不列入', () => {
  const { battle, boss } = setup();
  boss.target = 0;
  battle.attacks = [{ team: 'enemy', source: boss.id, target: 0, due: 100, ordinal: 0 }];
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
  const wolf = spawnEnemy(battle, 'wolf', { x: 0, y: 0 });
  battle.warnings = [boss.id, wolf.id, 999].map((source) => ({ source, row: 2, due: 100 }));
  expect(allyWarnings(enemyInspection(battle), 0)).toHaveLength(1);
  expect(allyWarnings(enemyInspection(battle), 12)).toEqual([]);
  expect(allyWarnings(enemyInspection(battle), 999)).toEqual([]);
  expect(allyWarnings(null, 0)).toEqual([]);
  const target = battle.allies[0];
  target.hp = 0;
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
  battle.allies = battle.allies.filter((ally) => ally.id !== 10);
  expect(allyWarnings(enemyInspection(battle), 10)).toEqual([]);
  target.hp = 100;
  expect(allyWarnings(enemyInspection(battle), 0)).toHaveLength(1);
  boss.hp = 0;
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
  boss.hp = 100;
  battle.enemies = battle.enemies.filter((enemy) => enemy.id !== boss.id);
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
  battle.enemies = [];
  expect(allyWarnings(enemyInspection(battle), 0)).toEqual([]);
});

test('冻结0准备/1ms/到期文案明确，两段时间不相加，SSR带精确来源行段入口且只读', () => {
  const { battle, boss } = setup();
  battle.time = 100;
  boss.id = 0;
  boss.frozenUntil = 101;
  battle.warnings = [
    { source: 0, row: 2, due: 100 },
    { source: 0, row: 2, due: 101, echo: true },
  ];
  const before = JSON.stringify(battle);
  const render = () =>
    renderToStaticMarkup(
      <AllyWarningsList warnings={allyWarnings(enemyInspection(battle), 0)} onSelect={noop} />,
    );
  const html = render();
  expect(html).toContain('待解冻');
  expect(html).toContain('解冻后准备 0.1 秒');
  expect(html.match(/冻结剩余 0.1 秒/g)).toHaveLength(2);
  expect(html).toContain('查看横扫预警：镇渊妖君，编号0，第3行，横扫');
  expect(html).toContain('查看横扫预警：镇渊妖君，编号0，第3行，回响');
  expect(html).toContain('实际释放时重新判断');
  expect(html).toContain('不代表释放顺序');
  expect(JSON.stringify(battle)).toBe(before);
  boss.frozenUntil = battle.time;
  expect(render()).toContain('待释放');
  expect(render()).toContain('准备剩余 0.1 秒');
  expect(render()).not.toContain('冻结剩余');
});

test('默认收起，空名单有解释；灵兽详情显示真实数量，初始预警定位回归且Session只读', () => {
  const empty = renderToStaticMarkup(<AllyWarningsList warnings={[]} onSelect={noop} />);
  expect(empty).toContain('当前没有已生成横扫预警波及此灵兽。');
  expect(empty).not.toContain('<button');
  const closed = renderToStaticMarkup(<AllyWarnings warnings={[]} onSelect={noop} />);
  expect(closed).toContain('波及此灵兽的横扫预警 · 0道');
  expect(closed).not.toContain('open=""');
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  const battle = session.battle!;
  const target = battle.allies[0];
  const boss = spawnEnemy(battle, 'boss', { x: 0, y: -2 });
  boss.target = target.id;
  battle.warnings = [
    { source: boss.id, row: target.position.y, due: 1000 },
    { source: boss.id, row: target.position.y, due: 2000, echo: true },
  ];
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} />,
  );
  expect(html).toContain('波及此灵兽的横扫预警 · 2道');
  const located = renderToStaticMarkup(
    <BattleInspection
      session={session}
      onClose={noop}
      onHandbook={noop}
      initialWarning={{ source: boss.id, row: target.position.y + 1, echo: true }}
    />,
  );
  expect(located).toContain('预警定位');
  expect(located.match(/open=""/g)).toHaveLength(1);
  expect(JSON.stringify(session)).toBe(before);
});
