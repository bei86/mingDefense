import { expect, test } from 'vitest';
import { clone, enemyDefinitions } from './content';
import { createCombat, stepCombat } from './combat';
import { spawnEnemy } from './combat-skills';
import previous from '../../docs/superpowers/specs/2026-10-16-prototype-balance-v8-snapshot.json';
import v9 from '../../docs/superpowers/specs/2026-10-18-prototype-balance-v9-snapshot.json';

test('v9只调整6–9系数、普通召唤者生命及首延迟；其余配置保持v8', () => {
  const expected = clone(previous);
  expected.contentVersion = v9.contentVersion;
  expected.status = v9.status;
  for (let i = 5; i <= 8; i++) {
    expected.stages[i].hpMultiplier = Number((expected.stages[i].hpMultiplier * 1.5).toFixed(4));
    expected.stages[i].attackMultiplier = Number(
      (expected.stages[i].attackMultiplier * 1.2).toFixed(4),
    );
  }
  const summoner = expected.enemies.find((e) => e.id === 'summoner')!;
  summoner.hp = 4000;
  Object.assign(summoner.skills, { firstSummonDelayMs: 10000 });
  expect(v9).toEqual(expected);
  expect(v9.contentVersion).toBe('prototype-2026-10-16-v9');
});

test('非零出生时刻先等10秒，之后20秒；新生孩子下一步才行动', () => {
  const s = createCombat([{ id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 4 } }], {
    stageId: 8,
  });
  s.spawns = [];
  s.time = 5000;
  const parent = spawnEnemy(s, 'summoner', { x: 1.5, y: 0 });
  expect(parent.nextSummon).toBe(15000);
  s.time = 14950;
  stepCombat(s);
  expect(s.enemies).toHaveLength(1);
  stepCombat(s);
  const children = s.enemies.filter((e) => e.owner === parent.id);
  expect(children).toHaveLength(2);
  expect(children.map((e) => e.x)).toEqual([parent.x - 0.3, parent.x + 0.3]);
  expect(children.every((e) => e.y === 0.0225 && e.cooldown === 0 && e.target === null)).toBe(true);
  expect(parent.nextSummon).toBe(35000);
  stepCombat(s);
  expect(children.every((e) => e.target === 1 && e.y > 0.0225)).toBe(true);
  s.time = 34950;
  stepCombat(s);
  expect(s.enemies.filter((e) => e.owner === parent.id)).toHaveLength(2);
  stepCombat(s);
  expect(s.enemies.filter((e) => e.owner === parent.id)).toHaveLength(4);
});

test('旧配置缺首次延迟时回退20秒周期，两位首领不读普通召唤延迟', () => {
  const skill: { firstSummonDelayMs?: number } = enemyDefinitions.summoner.skills;
  const delay = skill.firstSummonDelayMs;
  try {
    delete skill.firstSummonDelayMs;
    const s = createCombat([], { stageId: 8 });
    s.time = 12350;
    expect(spawnEnemy(s, 'summoner', { x: 0, y: 0 }).nextSummon).toBe(32350);
    skill.firstSummonDelayMs = 1;
    const first = createCombat([], { stageId: 5 });
    const second = createCombat([], { stageId: 10 });
    expect(spawnEnemy(first, 'boss', { x: 0, y: 0 }).nextSummon).toBe(0);
    expect(spawnEnemy(second, 'boss', { x: 0, y: 0 }).nextSummon).toBe(14000);
  } finally {
    skill.firstSummonDelayMs = delay;
  }
});
