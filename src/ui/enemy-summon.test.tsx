import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { bossDefinition, config, enemyDefinitions } from '../game/content';
import { enemySummon } from './enemy-summon';
import { EnemySummon, EnemySummonContent } from './EnemySummon';
import { enemyInspection } from './enemy-inspection';
import { EnemyInspection } from './EnemyInspection';

const noop = () => {};
function setup(kind: 'summoner' | 'boss' = 'summoner', stageId = 50) {
  const battle = createCombat(
    [{ id: 100, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } }],
    { stageId },
  );
  battle.spawns = [];
  const enemy = spawnEnemy(battle, kind, { x: 1.5, y: -8 });
  return { battle, enemy };
}

test('鸣咒犬真实首次与后续计时对齐，0到点后生成直属咒影并重置周期', () => {
  const { battle, enemy } = setup();
  const skill = enemyDefinitions.summoner.skills;
  const initial = enemySummon(battle, enemy.id)!;
  expect(initial).toMatchObject({
    kind: 'summoner',
    enabled: true,
    phaseRecorded: true,
    remainingMs: skill.firstSummonDelayMs,
    intervalMs: skill.summonEveryMs,
    count: skill.summonCount,
    cap: skill.maxLivingSummons,
    living: 0,
  });
  while (battle.time < enemy.nextSummon!) stepCombat(battle);
  expect(enemySummon(battle, enemy.id)!.remainingMs).toBe(0);
  expect(enemySummon(battle, enemy.id)!.living).toBe(0);
  stepCombat(battle);
  expect(enemySummon(battle, enemy.id)).toMatchObject({
    living: skill.summonCount,
    remainingMs: skill.summonEveryMs! - config.runtime.tickMs,
  });
  battle.time = enemy.nextSummon!;
  stepCombat(battle);
  expect(enemySummon(battle, enemy.id)!.living).toBe(skill.summonCount! * 2);
});

test('早期首领未转阶段无倒计时，低血不提前推测；真实转阶段开始召唤', () => {
  const { battle, enemy } = setup('boss', 5);
  expect(enemySummon(battle, enemy.id)).toMatchObject({
    enabled: false,
    phaseRecorded: true,
    remainingMs: null,
    living: 0,
  });
  enemy.hp = 1;
  expect(enemySummon(battle, enemy.id)!.enabled).toBe(false);
  const waiting = renderToStaticMarkup(
    <EnemySummonContent model={enemySummon(battle, enemy.id)!} />,
  );
  expect(waiting).toContain('进入第二阶段后启用召唤');
  expect(waiting).not.toContain('下次召唤判定');
  stepCombat(battle);
  expect(enemy.phase2).toBe(true);
  expect(enemySummon(battle, enemy.id)).toMatchObject({
    enabled: true,
    living: bossDefinition(5).summonCount,
    remainingMs: bossDefinition(5).summonIntervalMs - config.runtime.tickMs,
  });
});

test('开场召唤首领阶段强化只改变单次参数，不提前重置实例计时', () => {
  const { battle, enemy } = setup('boss');
  const skill = bossDefinition(50);
  const initialDue = enemy.nextSummon;
  expect(enemySummon(battle, enemy.id)).toMatchObject({
    enabled: true,
    count: skill.summonCount,
    remainingMs: skill.summonIntervalMs,
  });
  battle.time = 5000;
  enemy.hp = 1;
  expect(enemySummon(battle, enemy.id)!.count).toBe(skill.summonCount);
  stepCombat(battle);
  expect(enemy.nextSummon).toBe(initialDue);
  expect(enemySummon(battle, enemy.id)).toMatchObject({
    count: skill.phase2SummonCount,
    remainingMs: initialDue! - battle.time,
    living: 0,
  });
  battle.time = initialDue!;
  stepCombat(battle);
  expect(enemySummon(battle, enemy.id)!.living).toBe(skill.phase2SummonCount);
});

test.each(['summoner', 'boss'] as const)(
  '%s真实冻结顺延，解冻前计时保持，解冻后恢复并实际召唤',
  (kind) => {
    const { battle, enemy } = setup(kind);
    enemy.nextSummon = 100;
    enemy.frozenUntil = 150;
    for (let tick = 0; tick < 3; tick++) {
      expect(enemySummon(battle, enemy.id)).toMatchObject({
        remainingMs: 100,
        frozenMs: 150 - battle.time,
        living: 0,
      });
      stepCombat(battle);
    }
    expect(enemySummon(battle, enemy.id)).toMatchObject({ remainingMs: 100, frozenMs: 0 });
    stepCombat(battle);
    expect(enemySummon(battle, enemy.id)!.remainingMs).toBe(50);
    stepCombat(battle);
    expect(enemySummon(battle, enemy.id)!.remainingMs).toBe(0);
    stepCombat(battle);
    expect(enemySummon(battle, enemy.id)!.living).toBeGreaterThan(0);
  },
);

test.each(['summoner', 'boss'] as const)(
  '%s来源0与同名实例容量隔离，满额仍推进周期，空出一位实际只补一只',
  (kind) => {
    const { battle, enemy } = setup(kind);
    enemy.id = 0;
    enemy.nextSummon = 0;
    if (kind === 'boss') enemy.phase2 = true;
    const point = { x: enemy.x, y: enemy.y };
    const other = spawnEnemy(battle, kind, { x: 2, y: -8 });
    other.nextSummon = 1e8;
    const cap =
      kind === 'boss'
        ? bossDefinition(50).maxLivingSummons
        : enemyDefinitions.summoner.skills.maxLivingSummons!;
    const children = Array.from({ length: cap }, () =>
      spawnEnemy(battle, 'summoned_wolf', point, 0),
    );
    spawnEnemy(battle, 'summoned_wolf', point, 0).hp = 0;
    spawnEnemy(battle, 'summoned_wolf', point, other.id);
    spawnEnemy(battle, 'summoned_wolf', point, children[0].id);
    spawnEnemy(battle, 'split_fragment', point, 0);
    const before = JSON.stringify(battle);
    const model = enemySummon(battle, 0)!;
    expect(model).toMatchObject({ living: cap, cap, remainingMs: 0 });
    expect(enemySummon(battle, other.id)!.living).toBe(1);
    expect(JSON.stringify(battle)).toBe(before);
    const total = battle.enemies.filter((entry) => entry.hp > 0).length;
    stepCombat(battle);
    expect(battle.enemies.filter((entry) => entry.hp > 0)).toHaveLength(total);
    expect(enemySummon(battle, 0)!.remainingMs).toBeGreaterThan(0);
    children[0].hp = 0;
    expect(enemySummon(battle, 0)!.living).toBe(cap - 1);
    battle.time = enemy.nextSummon!;
    stepCombat(battle);
    expect(enemySummon(battle, 0)!.living).toBe(cap);
    expect(enemySummon(battle, other.id)!.living).toBe(1);
  },
);

test('缺计时不补0，缺阶段不推测，开场启用首领仍读取真实计时；0/1ms与冻结文案', () => {
  const { battle, enemy } = setup('boss', 5);
  delete enemy.phase2;
  expect(enemySummon(battle, enemy.id)).toMatchObject({ enabled: false, phaseRecorded: false });
  expect(
    renderToStaticMarkup(<EnemySummonContent model={enemySummon(battle, enemy.id)!} />),
  ).toContain('阶段未记录');
  const late = setup('boss');
  delete late.enemy.phase2;
  expect(enemySummon(late.battle, late.enemy.id)).toMatchObject({
    enabled: true,
    phaseRecorded: false,
  });
  expect(
    renderToStaticMarkup(<EnemySummonContent model={enemySummon(late.battle, late.enemy.id)!} />),
  ).toContain('按未强化参数显示');
  delete late.enemy.nextSummon;
  let html = renderToStaticMarkup(
    <EnemySummonContent model={enemySummon(late.battle, late.enemy.id)!} />,
  );
  expect(html).toContain('召唤计时未记录');
  expect(html).not.toContain('待判定');
  for (const due of [0, 1]) {
    late.enemy.nextSummon = due;
    html = renderToStaticMarkup(
      <EnemySummonContent model={enemySummon(late.battle, late.enemy.id)!} />,
    );
    expect(html).toContain(due === 0 ? '待判定' : '剩余 0.1 秒');
    late.enemy.frozenUntil = 100;
    html = renderToStaticMarkup(
      <EnemySummonContent model={enemySummon(late.battle, late.enemy.id)!} />,
    );
    expect(html).toContain('冻结剩余');
    expect(html).toContain('解冻后召唤计时');
    expect(html).toContain(due === 0 ? '待解冻' : '剩余 0.1 秒');
    delete late.enemy.frozenUntil;
  }
  late.enemy.nextSummon = -1;
  expect(enemySummon(late.battle, late.enemy.id)!.remainingMs).toBe(0);
});

test('普通/分裂/子代、死亡或缺失来源不显示；默认收起，详情接入且读取/渲染只读', () => {
  const { battle, enemy } = setup();
  for (const kind of ['wolf', 'splitter', 'split_fragment', 'summoned_wolf'] as const) {
    const ordinary = spawnEnemy(battle, kind, { x: enemy.x, y: enemy.y });
    expect(enemySummon(battle, ordinary.id)).toBeNull();
  }
  expect(enemySummon(null, 0)).toBeNull();
  expect(enemySummon(battle, 999)).toBeNull();
  expect(renderToStaticMarkup(<EnemySummon model={null} />)).toBe('');
  const before = JSON.stringify(battle);
  const view = enemyInspection(battle)!;
  expect(view.enemies.find((entry) => entry.id === enemy.id)!.summon).toEqual(
    enemySummon(battle, enemy.id),
  );
  const html = renderToStaticMarkup(
    <EnemyInspection
      view={view}
      stageId={50}
      selectedId={enemy.id}
      onSelect={noop}
      onTarget={noop}
    />,
  );
  expect(html).toContain('当前召唤状态');
  expect(html).not.toContain('召唤物存活');
  expect(renderToStaticMarkup(<EnemySummon model={enemySummon(battle, enemy.id)} />)).not.toContain(
    'open=""',
  );
  const content = renderToStaticMarkup(
    <EnemySummonContent model={enemySummon(battle, enemy.id)!} />,
  );
  expect(content).toContain('召唤物存活');
  expect(content).toContain('按空位结算');
  expect(content).toContain('满额时本次可能不生成');
  expect(JSON.stringify(battle)).toBe(before);
  enemy.hp = 0;
  expect(enemySummon(battle, enemy.id)).toBeNull();
  enemy.hp = 100;
  battle.enemies = battle.enemies.filter((entry) => entry.id !== enemy.id);
  expect(enemySummon(battle, enemy.id)).toBeNull();
});
