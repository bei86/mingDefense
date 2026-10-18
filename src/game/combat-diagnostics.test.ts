import { expect, test } from 'vitest';
import { createCombat, stepCombat } from './combat';
import { spawnEnemy } from './combat-skills';
import { observeEnemies } from './combat-diagnostics';
import { simulate } from './testing/campaign-simulation';

test('同一步出生并被范围伤害击杀的召唤物仍记录，诊断不进入战斗序列化', () => {
  const s = createCombat([{ id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 4 } }], {
    stageId: 8,
  });
  s.spawns = [];
  const events = observeEnemies(s);
  const parent = spawnEnemy(s, 'summoner', { x: 1.5, y: 0 });
  parent.nextSummon = 0;
  s.fields.push({ id: 1, born: -10000, x: 1.5, y: 0, damage: 1e6, hits: 0 });
  stepCombat(s);
  expect(s.enemies).toHaveLength(0);
  expect(events).toHaveLength(3);
  expect(events.filter((e) => e.owner === parent.id)).toEqual([
    { id: 2, kind: 'summoned_wolf', owner: parent.id, born: 0, died: 0 },
    { id: 3, kind: 'summoned_wolf', owner: parent.id, born: 0, died: 0 },
  ]);
  expect(s.kills).toBe(3);
  expect(JSON.stringify(s)).not.toContain('died');
});

test('中途开启仍使用敌人实际出生时间，重复开启不会重复记录', () => {
  const s = createCombat([]);
  s.time = 5000;
  spawnEnemy(s, 'summoner', { x: 0, y: 0 });
  s.time = 8000;
  const events = observeEnemies(s);
  expect(events[0].born).toBe(5000);
  expect(observeEnemies(s)).toBe(events);
  expect(events).toHaveLength(1);
});

test('诊断开关不改变完整路线、检查点及随机流', () => {
  const normal = simulate(20261014, 'assault', true, 10);
  const observed = simulate(20261014, 'assault', true, 10, true);
  expect({
    ...observed,
    results: observed.results.map(({ enemies: _enemies, ...sample }) => sample),
  }).toEqual(normal);
  for (const battle of observed.results) {
    expect(battle.enemies!.length).toBeGreaterThan(0);
    if (battle.result === 'victory')
      expect(battle.enemies!.every((e) => e.died !== undefined)).toBe(true);
  }
});
