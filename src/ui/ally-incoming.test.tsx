import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { config } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { allyIncoming } from './ally-incoming';
import { AllyIncoming, AllyIncomingList } from './AllyIncoming';
import { BattleInspection } from './BattleInspection';
import { enemiesTargeting, enemyInspection } from './enemy-inspection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 0, kind: 'boar', rank: 1, position: { x: 1, y: 3 } },
    { id: 10, kind: 'fortune_peach', rank: 1, position: { x: 4, y: 3 } },
  ]);
  battle.spawns = [];
  for (const ally of battle.allies) {
    ally.hp = ally.maxHp = 1e6;
    ally.cooldown = 1e8;
  }
  const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 3.5 });
  enemy.id = 0;
  enemy.target = 0;
  enemy.recheckAt = 1e8;
  return { battle, enemy };
}

test('真实普攻独立于改锁缓存，双方同号0准确保留，到期伤害原目标并移除', () => {
  const { battle, enemy } = setup();
  stepCombat(battle);
  const attack = battle.attacks.find((a) => a.team === 'enemy')!;
  enemy.target = 10;
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  expect(enemiesTargeting(view, 0)).toEqual([]);
  expect(allyIncoming(view, 0)).toEqual([
    { source: { id: 0, name: '奔雷狼' }, remainingMs: attack.due - battle.time, frozenMs: 0 },
  ]);
  expect(allyIncoming(view, 10)).toEqual([]);
  expect(JSON.stringify(battle)).toBe(before);
  const hp = battle.allies.map((ally) => ally.hp);
  battle.time = attack.due;
  stepCombat(battle);
  expect(battle.allies[0].hp).toBeLessThan(hp[0]);
  expect(battle.allies[1].hp).toBe(hp[1]);
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
});

test('真实冻结多tick准备剩余不流逝，解冻后继续计时，渲染明确冻结与准备分开', () => {
  const { battle, enemy } = setup();
  stepCombat(battle);
  enemy.frozenUntil = battle.time + 3 * config.runtime.tickMs;
  const remaining = allyIncoming(enemyInspection(battle), 0)[0].remainingMs;
  const render = () =>
    renderToStaticMarkup(
      <AllyIncomingList actions={allyIncoming(enemyInspection(battle), 0)} onSelect={noop} />,
    );
  expect(render()).toContain('冻结剩余 0.2 秒');
  expect(render()).toContain('解冻后准备');
  for (let i = 0; i < 3; i++) {
    stepCombat(battle);
    expect(allyIncoming(enemyInspection(battle), 0)[0].remainingMs).toBe(remaining);
  }
  expect(allyIncoming(enemyInspection(battle), 0)[0].frozenMs).toBe(0);
  stepCombat(battle);
  expect(allyIncoming(enemyInspection(battle), 0)[0].remainingMs).toBe(
    remaining - config.runtime.tickMs,
  );
  enemy.frozenUntil = battle.time + 100;
  battle.attacks[0].due = battle.time;
  expect(render()).toContain('待解冻');
  expect(render()).not.toContain('待释放');
  enemy.frozenUntil = battle.time;
  expect(render()).toContain('待释放');
});

test('不把缓存锁定或横扫当普攻，过滤己方/缺失来源、死亡来源/目标与退场目标', () => {
  const { battle, enemy } = setup();
  expect(enemiesTargeting(enemyInspection(battle), 0)).toHaveLength(1);
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
  battle.warnings = [{ source: enemy.id, row: 3, due: 100 }];
  battle.attacks = [
    { team: 'ally', source: 0, target: 0, due: 100, ordinal: 1 },
    { team: 'enemy', source: 999, target: 0, due: 100, ordinal: 0 },
  ];
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
  battle.attacks.push({ team: 'enemy', source: 0, target: 0, due: 100, ordinal: 0 });
  expect(allyIncoming(enemyInspection(battle), 0)).toHaveLength(1);
  enemy.hp = 0;
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
  enemy.hp = 100;
  battle.allies[0].hp = 0;
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
  battle.allies = battle.allies.filter((ally) => ally.id !== 0);
  expect(allyIncoming(enemyInspection(battle), 0)).toEqual([]);
  expect(allyIncoming(enemyInspection(battle), 999)).toEqual([]);
  expect(allyIncoming(null, 0)).toEqual([]);
});

test('同名来源按编号区分，重复动作保留、排序只读且返回来源对象独立', () => {
  const { battle, enemy } = setup();
  const other = spawnEnemy(battle, 'wolf', { x: 1.5, y: 3.5 });
  battle.time = 100;
  const action = { team: 'enemy' as const, source: 0, target: 0, due: 200, ordinal: 0 };
  battle.attacks = [{ ...action, source: other.id, due: 50 }, action, { ...action, due: 150 }];
  battle.enemies.reverse();
  enemy.frozenUntil = 300;
  const view = enemyInspection(battle)!;
  const before = JSON.stringify({ battle, view });
  const actions = allyIncoming(view, 0);
  expect(actions.map((a) => [a.source.id, a.remainingMs])).toEqual([
    [0, 50],
    [0, 100],
    [other.id, 0],
  ]);
  const html = renderToStaticMarkup(<AllyIncomingList actions={actions} onSelect={noop} />);
  expect(html).toContain('查看普攻来源：奔雷狼，编号0');
  expect(html).toContain(`查看普攻来源：奔雷狼，编号${other.id}`);
  expect(html.match(/type="button"/g)).toHaveLength(3);
  actions[0].source.name = 'changed';
  expect(actions[1].source.name).toBe('奔雷狼');
  expect(JSON.stringify({ battle, view })).toBe(before);
});

test('SSR默认收起、零项说明和暂停灵兽详情接入，只读Session', () => {
  const empty = renderToStaticMarkup(<AllyIncomingList actions={[]} onSelect={noop} />);
  expect(empty).toContain('当前没有敌人准备普攻此灵兽。');
  expect(empty).toContain('不保证命中');
  expect(empty).toContain('横扫');
  const closed = renderToStaticMarkup(<AllyIncoming actions={[]} onSelect={noop} />);
  expect(closed).toContain('正准备普攻此灵兽 · 0次');
  expect(closed).not.toContain('open=""');
  expect(closed).not.toContain('<button');
  const session = rosterPlaytest();
  session.start();
  const target = session.battle!.allies[1];
  const enemy = spawnEnemy(session.battle!, 'wolf', { x: 1, y: 1 });
  enemy.target = target.id;
  session.battle!.attacks.push({
    team: 'enemy',
    source: enemy.id,
    target: target.id,
    ordinal: 0,
    due: 100,
  });
  session.pause(true);
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} />,
  );
  expect(html).toContain('正准备普攻此灵兽 · 1次');
  expect(html).toContain('锁定此灵兽的敌人 · 1只');
  expect(JSON.stringify(session)).toBe(before);
});
