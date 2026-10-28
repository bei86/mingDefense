import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { heroes } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { battleAction } from './battle-action';
import { BattleInspection } from './BattleInspection';
import { incomingShields } from './incoming-shields';
import { IncomingShields, IncomingShieldsList } from './IncomingShields';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 10, kind: 'shield_fox', rank: 3, position: { x: 0, y: 0 } },
    { id: 11, kind: 'shield_fox', rank: 3, position: { x: 2, y: 0 } },
    { id: 0, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 0 } },
    { id: 12, kind: 'ember_mouse', rank: 1, position: { x: 4, y: 0 } },
    { id: 13, kind: 'shield_fox', rank: 3, position: null },
  ]);
  battle.spawns = [];
  for (const ally of battle.allies) ally.cooldown = 1e8;
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: -2 });
  enemy.id = 0;
  enemy.hp = enemy.maxHp = 1e8;
  enemy.cooldown = 1e8;
  return { battle, enemy };
}

test('真实施盾准备反查目标0，倒计时与狐行动一致，释放后增加目标护盾及来源战报', () => {
  const { battle } = setup();
  battle.allies[0].cooldown = 0;
  stepCombat(battle);
  const prepared = battle.attacks.find((action) => action.source === 10)!;
  expect(prepared.target).toBe(0);
  expect(incomingShields(battle, 0)).toEqual([
    {
      source: { id: 10, kind: 'shield_fox', rank: 3, position: { x: 0, y: 0 } },
      ordinal: 1,
      remainingMs: prepared.due - battle.time,
    },
  ]);
  expect(battleAction(battle, 10)!.pending[0]).toMatchObject({
    target: { side: 'ally', id: 0 },
    remainingMs: incomingShields(battle, 0)[0].remainingMs,
  });
  expect(incomingShields(battle, 11)).toEqual([]);
  for (let tick = 0; tick < 20 && battle.attacks.includes(prepared); tick++) stepCombat(battle);
  expect(incomingShields(battle, 0)).toEqual([]);
  const target = battle.allies.find((ally) => ally.id === 0)!;
  expect(target.shield).toBeGreaterThan(0);
  expect(battle.report!.units.find((entry) => entry.id === 10)!.shieldGiven).toBe(target.shield);
});

test('按实际队列保留同名多狐、来源0、自施盾及重复动作，due/source/ordinal稳定排序且快照独立', () => {
  const { battle } = setup();
  battle.allies[0].id = 0;
  battle.allies[2].id = 20;
  battle.time = 100;
  const action = { team: 'ally' as const, source: 0, target: 0, due: 200, ordinal: 2 };
  battle.attacks = [
    { ...action, source: 11 },
    action,
    { ...action, ordinal: 1 },
    { ...action, due: 50 },
  ];
  const before = JSON.stringify(battle);
  const actions = incomingShields(battle, 0);
  expect(actions.map((entry) => [entry.source.id, entry.ordinal, entry.remainingMs])).toEqual([
    [0, 2, 0],
    [0, 1, 100],
    [0, 2, 100],
    [11, 2, 100],
  ]);
  const html = renderToStaticMarkup(<IncomingShieldsList actions={actions} onSelect={noop} />);
  expect(html).toContain('查看施盾来源：月音狐3阶，编号0，1列1行');
  expect(html).toContain('查看施盾来源：月音狐3阶，编号11，3列1行');
  expect(html).toContain('第2次动作');
  expect(html.match(/type="button"/g)).toHaveLength(4);
  actions[0].source.position.x = 99;
  expect(actions[1].source.position.x).toBe(0);
  expect(JSON.stringify(battle)).toBe(before);
});

test('不把攻击/敌方同号/桃/备战/缺失来源或已有护盾当准备，倒下退场对象不提供入口', () => {
  const { battle } = setup();
  const target = battle.allies[2];
  target.shield = 10;
  target.shieldExpires = 1000;
  expect(incomingShields(battle, 0)).toEqual([]);
  const action = { team: 'ally' as const, source: 10, target: 0, due: 100, ordinal: 1 };
  battle.attacks = [
    action,
    { ...action, team: 'enemy' },
    { ...action, source: 12 },
    { ...action, source: 0 },
    { ...action, source: 13 },
    { ...action, source: 999 },
    { ...action, target: 11 },
  ];
  expect(incomingShields(battle, 0)).toHaveLength(1);
  expect(incomingShields(battle, 13)).toEqual([]);
  expect(incomingShields(battle, 999)).toEqual([]);
  expect(incomingShields(null, 0)).toEqual([]);
  battle.allies[0].hp = 0;
  expect(incomingShields(battle, 0)).toEqual([]);
  battle.allies[0].hp = 100;
  target.hp = 0;
  expect(incomingShields(battle, 0)).toEqual([]);
  target.hp = 100;
  battle.allies = battle.allies.filter((ally) => ally.id !== 0);
  expect(incomingShields(battle, 0)).toEqual([]);
  battle.allies.push(target);
  battle.allies = battle.allies.filter((ally) => ally.id !== 10);
  expect(incomingShields(battle, 0)).toEqual([]);
});

test('0/1ms正确显示，已有叠盾上限不伪造预计盾量，释放后实际可能不增加护盾', () => {
  const { battle } = setup();
  const target = battle.allies[2];
  target.shield = Math.floor(
    (target.maxHp * heroes.shield_fox.skills.shieldCapPercentOfTargetMaxHp!) / 100,
  );
  target.shieldExpires = 10000;
  const action = { team: 'ally' as const, source: 10, target: 0, due: 0, ordinal: 1 };
  battle.attacks = [action, { ...action, due: 1, ordinal: 2 }];
  const before = JSON.stringify(battle);
  const html = renderToStaticMarkup(
    <IncomingShieldsList actions={incomingShields(battle, 0)} onSelect={noop} />,
  );
  expect(html).toContain('待释放');
  expect(html).toContain('剩余 0.1 秒');
  expect(html).toContain('准备不保证获盾');
  expect(html).toContain('实际增加量在释放时结算');
  expect(JSON.stringify(battle)).toBe(before);
  const shield = target.shield;
  stepCombat(battle);
  stepCombat(battle);
  expect(target.shield).toBe(shield);
  expect(battle.report!.units.find((entry) => entry.id === 10)!.shieldGiven).toBe(0);
  expect(incomingShields(battle, 0)).toEqual([]);
});

test('空说明、默认收起和暂停详情真实数量接入，Session只读', () => {
  const empty = renderToStaticMarkup(<IncomingShieldsList actions={[]} onSelect={noop} />);
  expect(empty).toContain('当前没有月音狐准备为此灵兽施盾。');
  expect(empty).not.toContain('<button');
  const closed = renderToStaticMarkup(<IncomingShields actions={[]} onSelect={noop} />);
  expect(closed).toContain('正准备为此灵兽施盾 · 0次');
  expect(closed).not.toContain('open=""');
  const session = rosterPlaytest();
  session.start();
  session.pause(true);
  const target = session.battle!.allies[0];
  const fox = session.battle!.allies.find((ally) => ally.kind === 'shield_fox')!;
  session.battle!.attacks = [
    { team: 'ally', source: fox.id, target: target.id, due: 100, ordinal: 1 },
  ];
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BattleInspection session={session} onClose={noop} onHandbook={noop} />,
  );
  expect(html).toContain('正准备为此灵兽施盾 · 1次');
  expect(JSON.stringify(session)).toBe(before);
});
