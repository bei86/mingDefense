import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from './combat';
import { spawnEnemy } from './combat-skills';
import { clone, type EnemyKind } from './content';

function arena(kind: EnemyKind = 'croc', hp = 2000, stageId = 6) {
  const s = createCombat([{ id: 1, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 4 } }], {
    stageId,
    rng: 1,
  });
  s.spawns = [];
  s.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
  s.allies[0].cooldown = 100000;
  const enemy = spawnEnemy(s, kind, { x: 1.5, y: 3.5 });
  enemy.maxHp = 10000;
  enemy.hp = hp;
  s.attacks = [{ team: 'ally', source: 1, target: enemy.id, ordinal: 1, due: 0 }];
  return s;
}

describe('第六关解锁的终烬', () => {
  it('用战斗随机流斩杀残血，忽略减伤和易伤并仅统计剩余生命', () => {
    const s = arena();
    s.enemies[0].vulnerabilityUntil = 1000;
    s.enemies[0].vulnerabilityPercent = 10;
    const copy = clone(s);
    const talentRng = s.progression.rng;
    stepCombat(s);
    stepCombat(copy);
    expect(s).toEqual(copy);
    expect(s.enemies).toHaveLength(0);
    expect(s.damageDone).toBe(2000);
    expect(s.report!.units[0].damageDone).toBe(2000);
    expect(s.rng).not.toBe(1);
    expect(s.progression.rng).toBe(talentRng);
  });
  it('未触发时正常造成伤害', () => {
    const s = arena();
    s.rng = 10000;
    stepCombat(s);
    expect(s.enemies[0].hp).toBe(2000 - Math.floor(60 * 1.5 * 0.85));
  });
  it.each([
    ['boss', 2000],
    ['croc', 3000],
  ] as const)('%s在生命%j时不斩杀或消耗随机数', (kind, hp) => {
    const s = arena(kind, hp);
    stepCombat(s);
    expect(s.enemies[0].hp).toBeGreaterThan(0);
    expect(s.rng).toBe(1);
  });
  it('没有终烬时不新增随机采样', () => {
    const s = arena();
    delete s.progression.buffs.mouse_execute;
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    expect(s.rng).toBe(1);
  });
  it('岩铠领主免疫终烬，普攻照常受护甲减伤且不采样斩杀随机数', () => {
    const s = arena('boss', 2000, 15);
    stepCombat(s);
    expect(s.enemies[0].hp).toBe(2000 - Math.floor(60 * 1.5 * 0.85));
    expect(s.rng).toBe(1);
  });
});
