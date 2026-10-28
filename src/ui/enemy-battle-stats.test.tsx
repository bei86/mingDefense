import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { releaseAttack, spawnEnemy } from '../game/combat-skills';
import { config, type EnemyKind } from '../game/content';
import type { Packet } from '../game/combat-model';
import { enemyBattleStats } from './enemy-battle-stats';
import { enemyInspection } from './enemy-inspection';
import { EnemyBattleStats, EnemyBattleStatsContent } from './EnemyBattleStats';
import { EnemyInspection } from './EnemyInspection';

function setup(kind: EnemyKind = 'wolf', stageId = 50) {
  const battle = createCombat(
    [{ id: 100, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } }],
    { stageId },
  );
  battle.spawns = [];
  battle.allies[0].hp = battle.allies[0].maxHp = 1e8;
  const enemy = spawnEnemy(battle, kind, { x: 1.5, y: 3.5 });
  enemy.target = 100;
  enemy.recheckAt = enemy.nextCleave = enemy.nextSummon = 1e8;
  return { battle, enemy };
}

function releasedDamage(battle: ReturnType<typeof createCombat>, source: number): number {
  const packets: Packet[] = [];
  releaseAttack(
    battle,
    { team: 'enemy', source, target: 100, ordinal: 0, due: battle.time },
    packets,
  );
  return packets[0].damage;
}

test.each<EnemyKind>([
  'wolf',
  'runner',
  'croc',
  'ranged',
  'summoner',
  'summoned_wolf',
  'splitter',
  'split_fragment',
  'boss',
])('%s 当前普攻与真实释放数据包一致，投影不修改完整战斗', (kind) => {
  const { battle, enemy } = setup(kind);
  battle.time = 30000;
  const before = JSON.stringify(battle);
  const model = enemyBattleStats(battle, enemy.id)!;
  expect(JSON.stringify(battle)).toBe(before);
  expect(model.damage).toBe(releasedDamage(battle, enemy.id));
  expect(model.baseDamage).toBeGreaterThan(0);
  expect(enemyInspection(battle)!.enemies[0].stats).toEqual(model);
});

test('狂暴按出生时间跨越边界并封顶，冻结时仍沿战斗时间累积', () => {
  const { battle, enemy } = setup();
  enemy.born = 2000;
  for (const [time, stacks] of [
    [11999, 0],
    [12000, 1],
    [62000, 6],
    [100000, 6],
  ]) {
    battle.time = time;
    enemy.frozenUntil = time + 1000;
    const model = enemyBattleStats(battle, enemy.id)!;
    expect(model.rage).toMatchObject({ stacks, maxStacks: 6, percent: stacks * 5 });
    expect(model.damage).toBe(releasedDamage(battle, enemy.id));
    expect(model.frozen).toBe(true);
  }
});

test('低关未启用、召唤狼和缺kind不补造狂暴；缺出生沿用引擎计时并标注', () => {
  const early = setup('wolf', 5);
  early.battle.time = 60000;
  expect(enemyBattleStats(early.battle, early.enemy.id)!.rage).toBeNull();
  const { battle, enemy } = setup();
  battle.time = 30000;
  delete enemy.born;
  expect(enemyBattleStats(battle, enemy.id)!.rage).toMatchObject({
    stacks: 3,
    birthRecorded: false,
  });
  expect(enemyBattleStats(battle, enemy.id)!.damage).toBe(releasedDamage(battle, enemy.id));
  delete enemy.kind;
  expect(enemyBattleStats(battle, enemy.id)!.rage).toBeNull();
  expect(enemyBattleStats(battle, enemy.id)!.damage).toBe(releasedDamage(battle, enemy.id));
  enemy.kind = 'summoned_wolf';
  expect(enemyBattleStats(battle, enemy.id)!.rage).toBeNull();
});

test('首领残血不提前推测阶段，真实转阶段后间隔与引擎重新准备普攻一致', () => {
  const { battle, enemy } = setup('boss');
  enemy.hp = 1;
  const first = enemyBattleStats(battle, enemy.id)!;
  expect(first.phase2SpeedPercent).toBe(0);
  stepCombat(battle);
  const second = enemyBattleStats(battle, enemy.id)!;
  expect(enemy.phase2).toBe(true);
  expect(second.phase2SpeedPercent).toBe(35);
  expect(second.intervalMs).toBe(enemy.cooldown);
  expect(second.intervalMs).toBeLessThan(first.intervalMs);
  expect(second.damage).toBe(first.damage);
  delete enemy.phase2;
  const legacy = enemyBattleStats(battle, enemy.id)!;
  expect(legacy.phaseRecorded).toBe(false);
  expect(legacy.intervalMs).toBe(first.intervalMs);
});

test('普通敌人间隔与真实准备普攻一致，既有冷却不当成新动作间隔', () => {
  const { battle, enemy } = setup('ranged');
  const model = enemyBattleStats(battle, enemy.id)!;
  stepCombat(battle);
  expect(enemy.cooldown).toBe(model.intervalMs);
  stepCombat(battle);
  expect(enemy.cooldown).toBe(model.intervalMs - config.runtime.tickMs);
  expect(enemyBattleStats(battle, enemy.id)!.intervalMs).toBe(model.intervalMs);
});

test('霜尾与迟滞合并封顶、到期移除，投影移速对应真实移动步长', () => {
  for (const [slowStacks, localSlow, expected] of [
    [2, true, 30],
    [20, true, 60],
    [2, false, 10],
  ] as const) {
    const { battle, enemy } = setup();
    enemy.y = -5;
    battle.time = 1000;
    battle.progression.buffs.slow = slowStacks;
    enemy.slowUntil = localSlow ? 2000 : 1000;
    const model = enemyBattleStats(battle, enemy.id)!;
    expect(model.slowPercent).toBe(expected);
    const before = { x: enemy.x, y: enemy.y };
    stepCombat(battle);
    expect(Math.hypot(enemy.x - before.x, enemy.y - before.y)).toBeCloseTo(model.speed * 0.05, 10);
  }
});

test('冻结只标注解冻后参数，不混淆实际位移；死亡、缺ID与空战斗安全', () => {
  const { battle, enemy } = setup();
  enemy.y = -5;
  enemy.frozenUntil = 100;
  const before = JSON.stringify(battle);
  const model = enemyBattleStats(battle, enemy.id)!;
  expect(model.frozen).toBe(true);
  expect(model.speed).toBeGreaterThan(0);
  expect(JSON.stringify(battle)).toBe(before);
  stepCombat(battle);
  expect(enemy.y).toBe(-5);
  battle.time = 100;
  expect(enemyBattleStats(battle, enemy.id)!.frozen).toBe(false);
  enemy.hp = 0;
  expect(enemyBattleStats(battle, enemy.id)).toBeNull();
  expect(enemyBattleStats(battle, 999)).toBeNull();
  expect(enemyBattleStats(null, enemy.id)).toBeNull();
});

test('默认折叠、接入当前实例；展开区分当前值、护盾与游戏内间隔', () => {
  const { battle, enemy } = setup();
  battle.time = 30000;
  const model = enemyBattleStats(battle, enemy.id)!;
  const closed = renderToStaticMarkup(<EnemyBattleStats model={model} />);
  expect(closed).toContain('当前战斗属性');
  expect(closed).not.toContain('<table');
  expect(closed).not.toContain('open=""');
  const content = renderToStaticMarkup(<EnemyBattleStatsContent model={model} />);
  expect(content).toContain('本关基础普攻');
  expect(content).toContain('当前普攻值');
  expect(content).toContain('3 / 6 层');
  expect(content).toContain('+15%');
  expect(content).toContain('未扣目标护盾');
  expect(content).toContain('不代表下一次命中时间');
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={enemyInspection(battle)}
      stageId={50}
      selectedId={enemy.id}
      onSelect={() => {}}
      onTarget={() => {}}
    />,
  );
  expect(html).toContain('当前战斗属性');
  expect(html).toContain('当前普攻状态');
});

test('冻结、缺出生和缺阶段说明不伪造记录，空模型不渲染', () => {
  const { battle, enemy } = setup();
  delete enemy.born;
  enemy.frozenUntil = 100;
  const wolf = renderToStaticMarkup(
    <EnemyBattleStatsContent model={enemyBattleStats(battle, enemy.id)!} />,
  );
  expect(wolf).toContain('解冻后接近移速');
  expect(wolf).toContain('冻结中');
  expect(wolf).toContain('出生时间未记录');
  const boss = setup('boss');
  delete boss.enemy.phase2;
  const html = renderToStaticMarkup(
    <EnemyBattleStatsContent model={enemyBattleStats(boss.battle, boss.enemy.id)!} />,
  );
  expect(html).toContain('阶段未记录');
  expect(html).toContain('未加速');
  expect(renderToStaticMarkup(<EnemyBattleStats model={null} />)).toBe('');
});
