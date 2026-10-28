import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { config } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { combatFinishStatus } from './combat-finish-status';

test('无战斗、固定队列未消费完或战斗已结束时隐藏，不以时间或击退数代替游标', () => {
  expect(combatFinishStatus(null)).toBeNull();
  const battle = createCombat([]);
  battle.time = config.runtime.stageLimitMs;
  battle.kills = 999;
  battle.spawnIndex = battle.spawns.length - 1;
  expect(combatFinishStatus(battle)).toBeNull();
  battle.spawnIndex++;
  expect(combatFinishStatus(battle)).toContain('等待战果判定');
  for (const result of ['victory', 'defeat'] as const) {
    battle.result = result;
    expect(combatFinishStatus(battle)).toBeNull();
  }
});

test('场上数包含首领、召唤与分裂，排除死亡实例，优先于残留招式且只读', () => {
  const battle = createCombat([], { stageId: 50 });
  battle.spawnIndex = battle.spawns.length;
  for (const kind of ['boss', 'summoned_wolf', 'split_fragment'] as const) {
    spawnEnemy(battle, kind, { x: 1, y: 0 });
  }
  spawnEnemy(battle, 'wolf', { x: 1, y: 0 }).hp = 0;
  spawnEnemy(battle, 'wolf', { x: 1, y: 0 }).hp = -10;
  battle.warnings.push({ source: 1, row: 1, due: 1000 });
  const before = JSON.stringify(battle);
  expect(combatFinishStatus(battle)).toBe('固定敌袭已出完 · 场上 3 只');
  expect(JSON.stringify(battle)).toBe(before);
});

test.each(['attacks', 'released', 'fields', 'warnings'] as const)(
  '无活敌但%s仍有待结算事件时不能暗示已胜利，投影只读',
  (queue) => {
    const battle = createCombat([]);
    battle.spawns = [];
    const pending = {
      attacks: { due: 1000, source: 1, target: 2, team: 'ally' as const, ordinal: 1 },
      released: {
        due: 1000,
        damage: 1,
        kind: 'ember_mouse' as const,
        source: 1,
        shape: 'area' as const,
        target: 2,
        point: { x: 0, y: 0 },
        radius: 1,
      },
      fields: { id: 1, x: 0, y: 0, born: 0, damage: 1, hits: 0 },
      warnings: { source: 1, row: 1, due: 1000 },
    };
    Object.assign(battle, { [queue]: [pending[queue]] });
    const before = JSON.stringify(battle);
    expect(combatFinishStatus(battle)).toBe('固定敌袭已出完 · 招式结算中');
    expect(JSON.stringify(battle)).toBe(before);
  },
);

test('仅剩待清理的死亡实体时等待引擎判定；真实分裂后重新显示活敌数', () => {
  const battle = createCombat([
    { id: 1, kind: 'fortune_peach', rank: 1, position: { x: 0, y: 5 } },
  ]);
  battle.spawns = [];
  spawnEnemy(battle, 'splitter', { x: 3, y: -2 }).hp = 0;
  expect(combatFinishStatus(battle)).toBe('固定敌袭已出完 · 等待战果判定');
  expect(battle.result).toBeNull();
  stepCombat(battle);
  expect(battle.enemies.length).toBeGreaterThan(0);
  expect(battle.enemies.every((enemy) => enemy.kind === 'split_fragment')).toBe(true);
  expect(combatFinishStatus(battle)).toBe(`固定敌袭已出完 · 场上 ${battle.enemies.length} 只`);
});

test('真实引擎从待清敌到残留招式，延迟命中消失后才胜利并隐藏', () => {
  const battle = createCombat([
    { id: 1, kind: 'fortune_peach', rank: 1, position: { x: 0, y: 5 } },
  ]);
  battle.spawns = [{ at: 0, x: 3, kind: 'wolf' }];
  expect(combatFinishStatus(battle)).toBeNull();
  stepCombat(battle);
  expect(combatFinishStatus(battle)).toBe('固定敌袭已出完 · 场上 1 只');
  battle.enemies[0].hp = 0;
  battle.released.push({
    shape: 'area',
    source: 1,
    target: battle.enemies[0].id,
    kind: 'ember_mouse',
    point: { x: 3, y: -2 },
    due: battle.time + 200,
    damage: 1,
    radius: 1,
  });
  stepCombat(battle);
  expect(battle.enemies).toHaveLength(0);
  expect(combatFinishStatus(battle)).toBe('固定敌袭已出完 · 招式结算中');
  expect(battle.result).toBeNull();
  for (let i = 0; i < 10 && !battle.result; i++) stepCombat(battle);
  expect(battle.result).toBe('victory');
  expect(combatFinishStatus(battle)).toBeNull();
});

test('Session暂停或待选天赋读取不改完整状态，tick不推进', () => {
  const session = rosterPlaytest();
  session.start();
  session.battle!.spawnIndex = session.battle!.spawns.length;
  spawnEnemy(session.battle!, 'wolf', { x: 1, y: -2 });
  session.held = true;
  session.pause(true);
  const before = JSON.stringify(session);
  expect(combatFinishStatus(session.battle)).toContain('场上 1 只');
  session.tick();
  expect(JSON.stringify(session)).toBe(before);
  session.pause(false);
  session.battle!.choices = ['attack_speed'];
  const choosing = JSON.stringify(session);
  expect(combatFinishStatus(session.battle)).toContain('场上 1 只');
  session.tick();
  expect(JSON.stringify(session)).toBe(choosing);
});
