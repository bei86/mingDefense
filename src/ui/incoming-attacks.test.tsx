import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { releaseAttack, spawnEnemy } from '../game/combat-skills';
import { incomingAttacks } from './incoming-attacks';
import { EnemyIncoming, EnemyIncomingList } from './EnemyIncoming';
import { enemyInspection } from './enemy-inspection';
import { EnemyInspection } from './EnemyInspection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 0, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
    { id: 10, kind: 'ember_mouse', rank: 3, position: { x: 1, y: 0 } },
    { id: 11, kind: 'shield_fox', rank: 3, position: { x: 2, y: 0 } },
    { id: 12, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 0 } },
  ]);
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: 0.5 });
  enemy.id = 0;
  enemy.cooldown = 1e8;
  return { battle, enemy };
}

test('真实准备与释放对照，双方同号0仍按己方来源，读取/渲染不修改战斗', () => {
  const { battle, enemy } = setup();
  stepCombat(battle);
  const before = JSON.stringify(battle);
  const actions = incomingAttacks(battle, enemy.id);
  expect(actions.map((a) => a.source.id)).toEqual([0, 10]);
  const action = battle.attacks.find((a) => a.team === 'ally' && a.source === 0)!;
  expect(actions[0]).toMatchObject({
    ordinal: action.ordinal,
    remainingMs: action.due - battle.time,
  });
  expect(enemyInspection(battle)!.enemies[0].incoming).toEqual(actions);
  const html = renderToStaticMarkup(<EnemyIncomingList actions={actions} onSelect={noop} />);
  expect(html).toContain('查看攻击来源：烬灵鼠3阶，编号0，1列1行');
  expect(html).toContain('查看攻击来源：烬灵鼠3阶，编号10，2列1行');
  expect(html.match(/type="button"/g)).toHaveLength(2);
  expect(html).toContain('第1次动作');
  expect(JSON.stringify(battle)).toBe(before);
  actions[0].source.position.x = 99;
  expect(battle.allies[0].position.x).toBe(0);
  const packets: Parameters<typeof releaseAttack>[2] = [];
  releaseAttack(battle, action, packets);
  expect(packets.some((packet) => packet.team === 'enemy' && packet.id === 0)).toBe(true);
  battle.attacks = battle.attacks.filter((a) => a !== action);
  expect(incomingAttacks(battle, 0).map((a) => a.source.id)).toEqual([10]);
});

test('只计直接准备目标，排除敌方/施盾/桃/其他目标/失效来源；不按射程推测', () => {
  const { battle, enemy } = setup();
  const other = spawnEnemy(battle, 'wolf', { x: 0.6, y: 0.5 });
  const action = { team: 'ally' as const, source: 0, target: enemy.id, due: 100, ordinal: 1 };
  battle.attacks = [
    action,
    { ...action, team: 'enemy' },
    { ...action, source: 11 },
    { ...action, source: 12 },
    { ...action, source: 999 },
    { ...action, source: 10, target: other.id },
  ];
  expect(incomingAttacks(battle, 0).map((a) => a.source.id)).toEqual([0]);
  battle.allies[0].hp = 0;
  expect(incomingAttacks(battle, 0)).toEqual([]);
  const packets: Parameters<typeof releaseAttack>[2] = [];
  releaseAttack(battle, action, packets);
  expect(packets).toEqual([]);
  battle.allies[0].hp = 10;
  battle.allies = battle.allies.filter((ally) => ally.id !== 0);
  expect(incomingAttacks(battle, 0)).toEqual([]);
  enemy.hp = 0;
  expect(incomingAttacks(battle, 0)).toEqual([]);
  expect(incomingAttacks(null, 0)).toEqual([]);
  expect(incomingAttacks(battle, 999)).toEqual([]);
});

test('按到期/编号/次数稳定排序，过期下限0并保留每次动作，不重排原队列', () => {
  const { battle } = setup();
  battle.time = 100;
  const action = { team: 'ally' as const, source: 0, target: 0, due: 200, ordinal: 2 };
  battle.attacks = [
    action,
    { ...action, source: 10 },
    { ...action, ordinal: 1 },
    { ...action, due: 50 },
  ];
  const before = JSON.stringify(battle);
  const actions = incomingAttacks(battle, 0);
  expect(actions.map((a) => [a.source.id, a.ordinal, a.remainingMs])).toEqual([
    [0, 2, 0],
    [0, 1, 100],
    [0, 2, 100],
    [10, 2, 100],
  ]);
  const html = renderToStaticMarkup(<EnemyIncomingList actions={actions} onSelect={noop} />);
  expect(html).toContain('待释放');
  expect(html).toContain('剩余 0.1 秒');
  expect(JSON.stringify(battle)).toBe(before);
});

test('详情接入默认收起与零项说明，明确准备不保证命中', () => {
  const { battle } = setup();
  const empty = renderToStaticMarkup(<EnemyIncomingList actions={[]} onSelect={noop} />);
  expect(empty).toContain('当前没有灵兽准备直接攻击此敌人。');
  expect(empty).toContain('不保证命中');
  const closed = renderToStaticMarkup(<EnemyIncoming actions={[]} onSelect={noop} />);
  expect(closed).toContain('正准备攻击此敌人 · 0次');
  expect(closed).not.toContain('open=""');
  expect(closed).not.toContain('<button');
  stepCombat(battle);
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={enemyInspection(battle)}
      stageId={1}
      selectedId={0}
      onSelect={noop}
      onTarget={noop}
    />,
  );
  expect(html).toContain('正准备攻击此敌人 · 2次');
});
