import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { bossDefinition, config, enemyDefinitions } from '../game/content';
import { Session } from '../game/session';
import { battleSnapshotDocument } from './battle-snapshot';
import { BattleSnapshotContent } from './BattleSnapshot';

function setup(kind: 'summoner' | 'boss' = 'summoner', stageId = 50) {
  const session = new Session();
  session.preparation.stageId = stageId;
  session.preparation.units = [{ id: 0, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } }];
  const battle = createCombat(session.preparation.units, { stageId });
  battle.spawns = [];
  session.battle = battle;
  session.phase = 'combat';
  session.pause(true);
  const enemy = spawnEnemy(battle, kind, { x: 1.5, y: -8 });
  enemy.nextCleave = 1e8;
  return { session, battle, enemy };
}

function section(session: Session): string {
  return (
    battleSnapshotDocument(session, true)!
      .text.split('## 敌人当前召唤\n')[1]
      ?.split('## 尚未出场的队列\n')[0] ?? ''
  );
}

test('快照记录普通首次/后续召唤，真实到点判定后增加直属存活并刷新计时', () => {
  const { session, battle, enemy } = setup();
  const count = enemyDefinitions.summoner.skills.summonCount!;
  expect(section(session)).toContain('下次召唤判定：剩余10秒');
  expect(section(session)).toContain('直属存活咒影：0/');
  expect(section(session)).toContain(`单次召唤参数：${count}只咒影`);
  battle.time = enemy.nextSummon!;
  expect(section(session)).toContain('下次召唤判定：待判定');
  stepCombat(battle);
  const child = battle.enemies.find((entry) => entry.owner === enemy.id)!;
  expect(child.kind).toBe('summoned_wolf');
  expect(section(session)).toContain(`直属存活咒影：${count}/`);
  expect(section(session)).not.toContain('下次召唤判定：待判定');
  battle.time = enemy.nextSummon!;
  stepCombat(battle);
  expect(section(session)).toContain(`直属存活咒影：${count * 2}/`);
  expect(section(session)).toContain('到点按空位结算');
  expect(section(session)).toContain('未生成召唤物不计入固定队列');
});

test('早期首领低生命不提前当作启用，真实转阶段后记录召唤与计时', () => {
  const { session, battle, enemy } = setup('boss', 5);
  enemy.hp = 1;
  expect(section(session)).toContain('尚未启用 · 进入第二阶段后启用召唤');
  expect(section(session)).not.toContain('下次召唤判定');
  stepCombat(battle);
  expect(enemy.phase2).toBe(true);
  expect(section(session)).toContain('已启用');
  expect(section(session)).toContain('下次召唤判定：剩余');
  expect(section(session)).toContain(`直属存活咒影：${bossDefinition(5).summonCount}/`);
});

test('开场启用首领真实强化后更新单次参数，既有召唤时间不被重置', () => {
  const { session, battle, enemy } = setup('boss');
  const skill = bossDefinition(50);
  const due = enemy.nextSummon!;
  expect(section(session)).toContain(`单次召唤参数：${skill.summonCount}只咒影`);
  battle.time = 5000;
  enemy.hp = 1;
  stepCombat(battle);
  expect(enemy.nextSummon).toBe(due);
  expect(section(session)).toContain(`单次召唤参数：${skill.phase2SummonCount}只咒影`);
  expect(section(session)).toContain('直属存活咒影：0/');
  battle.time = due;
  stepCombat(battle);
  expect(section(session)).toContain(`直属存活咒影：${skill.phase2SummonCount}/`);
});

test.each(['summoner', 'boss'] as const)(
  '%s冻结分列两种计时，真实冻结步保持、解冻后恢复',
  (kind) => {
    const { session, battle, enemy } = setup(kind);
    enemy.nextSummon = 100;
    enemy.frozenUntil = 3 * config.runtime.tickMs;
    expect(section(session)).toContain('冻结剩余0.2秒');
    for (let i = 0; i < 3; i++) {
      expect(section(session)).toContain('解冻后召唤计时：剩余0.1秒');
      stepCombat(battle);
    }
    expect(section(session)).not.toContain('冻结剩余');
    stepCombat(battle);
    stepCombat(battle);
    expect(section(session)).toContain('下次召唤判定：待判定');
    enemy.frozenUntil = battle.time + 50;
    expect(section(session)).toContain('解冻后召唤计时：待解冻');
    expect(section(session)).not.toContain('下次召唤判定');
    stepCombat(battle);
    stepCombat(battle);
    expect(section(session)).toContain('直属存活咒影：');
    expect(battle.enemies.some((entry) => entry.owner === enemy.id)).toBe(true);
  },
);

test.each(['summoner', 'boss'] as const)(
  '%s来源0与同名来源容量独立，满额判定推进且单空位只补一只',
  (kind) => {
    const { session, battle, enemy } = setup(kind);
    enemy.id = 0;
    enemy.nextSummon = 0;
    if (kind === 'boss') enemy.phase2 = true;
    const point = { x: enemy.x, y: enemy.y };
    const other = spawnEnemy(battle, kind, point);
    other.nextSummon = other.nextCleave = 1e8;
    const cap =
      kind === 'boss'
        ? bossDefinition(50).maxLivingSummons
        : enemyDefinitions.summoner.skills.maxLivingSummons!;
    const children = Array.from({ length: cap }, () =>
      spawnEnemy(battle, 'summoned_wolf', point, 0),
    );
    spawnEnemy(battle, 'summoned_wolf', point, other.id);
    spawnEnemy(battle, 'summoned_wolf', point, children[0].id);
    spawnEnemy(battle, 'summoned_wolf', point, 0).hp = 0;
    spawnEnemy(battle, 'split_fragment', point, 0);
    const first = section(session);
    expect(first.split(`#0：`)[1]?.split('\n- ')[0]).toContain(`直属存活咒影：${cap}/${cap}只`);
    expect(first.split(`#${other.id}：`)[1]).toContain(`直属存活咒影：1/${cap}只`);
    const aliveCount = battle.enemies.filter((entry) => entry.hp > 0).length;
    stepCombat(battle);
    expect(battle.enemies.filter((entry) => entry.hp > 0)).toHaveLength(aliveCount);
    expect(section(session)).toContain('满额时本次可能不生成，之后仍按周期再判定');
    expect(section(session).split(`#0：`)[1]?.split('\n- ')[0]).not.toContain('待判定');
    children[0].hp = 0;
    expect(section(session)).toContain(`直属存活咒影：${cap - 1}/${cap}只`);
    battle.time = enemy.nextSummon!;
    stepCombat(battle);
    expect(section(session).split(`#0：`)[1]?.split('\n- ')[0]).toContain(
      `直属存活咒影：${cap}/${cap}只`,
    );
    expect(battle.enemies.filter((entry) => entry.hp > 0)).toHaveLength(aliveCount);
  },
);

test('缺阶段与缺计时不伪造0或推断启用，开场启用首领缺阶段仍保留真实计时', () => {
  const early = setup('boss', 5);
  delete early.enemy.phase2;
  early.enemy.hp = 1;
  expect(section(early.session)).toContain('阶段未记录，无法确认是否已启用召唤');
  expect(section(early.session)).not.toContain('下次召唤判定');
  const late = setup('boss');
  delete late.enemy.phase2;
  expect(section(late.session)).toContain('阶段未记录，单次数量按未强化参数显示');
  expect(section(late.session)).toContain('下次召唤判定：剩余');
  delete late.enemy.nextSummon;
  expect(section(late.session)).toContain('召唤计时未记录');
  expect(section(late.session)).not.toContain('待判定');
  late.enemy.nextSummon = 1;
  expect(section(late.session)).toContain('下次召唤判定：剩余0.1秒');
  late.enemy.nextSummon = 0;
  expect(section(late.session)).toContain('下次召唤判定：待判定');
});

test('首领优先且同种按编号稳定，倒下来源无旧计时，空态/SSR完整，读取Session与RNG只读', () => {
  const { session, battle, enemy } = setup();
  const boss = spawnEnemy(battle, 'boss', { x: 2, y: -8 });
  const other = spawnEnemy(battle, 'summoner', { x: 3, y: -8 });
  battle.enemies.reverse();
  const before = JSON.stringify(session);
  const document = battleSnapshotDocument(session, true)!;
  const text = section(session);
  expect(text.indexOf(`#${boss.id}：`)).toBeLessThan(text.indexOf(`#${enemy.id}：`));
  expect(text.indexOf(`#${enemy.id}：`)).toBeLessThan(text.indexOf(`#${other.id}：`));
  expect(battleSnapshotDocument(session, true)).toEqual(document);
  const html = renderToStaticMarkup(<BattleSnapshotContent document={document} />);
  expect(html).toContain('召唤计时与容量');
  expect(html).toContain('只供复盘，不能恢复进度');
  expect(JSON.stringify(session)).toBe(before);
  for (const entry of battle.enemies) entry.hp = 0;
  spawnEnemy(battle, 'wolf', { x: 2, y: -8 });
  expect(section(session)).toContain('当前无存活召唤来源。');
  expect(section(session)).not.toContain('下次召唤判定');
});
