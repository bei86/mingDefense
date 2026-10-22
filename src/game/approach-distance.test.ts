import { historicalBalance } from './testing/legacy-approach';
import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat, waveSpawns } from './combat';
import { collectDeaths, contact, spawnEnemy } from './combat-skills';
import { bossDefinition, config, distance, enemyDefinitions, type EnemyKind } from './content';
import type { Unit } from './model';
import { Session, placementError } from './session';
import { validSave } from './persistence';
import v15 from '../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';

function fullBoard(stageId = 1) {
  const units: Unit[] = Array.from({ length: 36 }, (_, i) => ({
    id: i + 1,
    kind: 'ember_mouse',
    rank: 6,
    position: { x: i % 6, y: Math.floor(i / 6) },
  }));
  const s = createCombat(units, { stageId });
  for (const ally of s.allies) ally.cooldown = 200000;
  return s;
}

describe('3格接敌距离 P', () => {
  it('前40关排除数值校准后相对v15只改出生行和版本标识，阵地仍限6×6', () => {
    expect({
      ...historicalBalance(),
      contentVersion: v15.contentVersion,
      status: v15.status,
      waves: { ...config.waves, spawnRow: v15.waves.spawnRow },
    }).toEqual(v15);
    const s = new Session();
    for (const y of [-5, -1, 6]) {
      expect(placementError(s.preparation, 'ember_mouse', { x: 1, y })).toBeTruthy();
      const save = s.exportSave();
      save.preparation.unlocked.push(`1,${y}`);
      expect(validSave(save)).toBe(false);
    }
  });
  it('所有关卡的波次出生点距满首排最近占格中心3格，仍连续出怪', () => {
    expect(config.waves.spawnRow + 0.5).toBe(-2.5);
    for (const stage of config.stages) {
      const s = fullBoard(stage.id);
      const spawns = waveSpawns(stage.id);
      expect(spawns.filter((e) => e.kind !== 'boss').map((e) => e.at)).toEqual(
        spawns.filter((e) => e.kind !== 'boss').map((_, i) => i * 1000),
      );
      for (const spawn of spawns) {
        const point = { x: spawn.x, y: config.waves.spawnRow + 0.5 };
        expect(Math.min(...s.allies.map((a) => distance(point, contact(a, point))))).toBe(3);
      }
    }
    const s = fullBoard();
    for (let t = 0; t <= 3000; t += 50) {
      expect(s.spawnIndex).toBe(Math.min(Math.ceil(t / 1000), s.spawns.length));
      stepCombat(s);
    }
    expect(s.spawnIndex).toBe(4);
  });

  it.each<[EnemyKind, number]>([
    ['wolf', 1],
    ['runner', 1],
    ['croc', 1],
    ['summoner', 8],
    ['splitter', 9],
    ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((stage): [EnemyKind, number] => ['boss', stage]),
  ])('%s / 第%d关：满阵先行进，停在射程边界，再经过200ms前摇普攻', (kind, stageId) => {
    const s = fullBoard(stageId);
    s.spawns = [{ at: 0, x: 3.5, kind }];
    stepCombat(s);
    const enemy = s.enemies[0];
    expect(enemy.y).toBeGreaterThan(-2.5);
    expect(s.attacks).toHaveLength(0);
    // Isolate normal attacks from the independently timed boss/summoner skills.
    enemy.nextSummon = 200000;
    enemy.nextCleave = 200000;
    const definition = kind === 'boss' ? bossDefinition(stageId) : enemyDefinitions[kind];
    const entryMs = ((3 - definition.rangeCells) / definition.speedCellsPerSecond) * 1000;
    for (let i = 0; i < 500 && !s.attacks.length; i++) stepCombat(s);
    const attack = s.attacks[0];
    expect(attack).toMatchObject({ team: 'enemy', source: enemy.id });
    const queuedAt = attack.due - config.targeting.enemyWindupMs;
    expect(queuedAt).toBeGreaterThanOrEqual(entryMs - 1e-6);
    expect(queuedAt).toBeLessThan(entryMs + 51);
    const target = s.allies.find((a) => a.id === attack.target)!;
    expect(distance(enemy, contact(target, enemy))).toBeCloseTo(definition.rangeCells);
    const hp = target.hp;
    while (s.time < attack.due) stepCombat(s);
    expect(target.hp).toBe(hp);
    stepCombat(s);
    expect(target.hp).toBeLessThan(hp);
  });

  it('4格远程在3格出生距离内可立即进入前摇，200ms后才造成伤害', () => {
    const s = fullBoard(7);
    s.spawns = [{ at: 0, x: 3.5, kind: 'ranged' }];
    stepCombat(s);
    const enemy = s.enemies[0];
    expect(enemy.y).toBe(-2.5);
    expect(s.attacks).toMatchObject([{ team: 'enemy', source: enemy.id, due: 200 }]);
    const target = s.allies.find((a) => a.id === s.attacks[0].target)!;
    const hp = target.hp;
    while (s.time < 200) stepCombat(s);
    expect(target.hp).toBe(hp);
    stepCombat(s);
    expect(target.hp).toBeLessThan(hp);
  });

  it('冻结不移动、减速降低近战行进距离，解冻后继续走', () => {
    const s = fullBoard();
    s.spawns = [];
    const enemy = spawnEnemy(s, 'wolf', { x: 3.5, y: -2.5 });
    enemy.frozenUntil = 1000;
    while (s.time < 1000) stepCombat(s);
    expect(enemy.y).toBe(-2.5);
    enemy.slowUntil = 2000;
    while (s.time < 2000) stepCombat(s);
    expect(enemy.y).toBeCloseTo(-2.5 + 0.55 * 0.8);
    expect(s.attacks).toHaveLength(0);
  });

  it('召唤与死亡分裂保留父怪位置，不传回波次出生线', () => {
    const s = fullBoard(8);
    s.spawns = [];
    const parent = spawnEnemy(s, 'summoner', { x: 3.5, y: -1 });
    parent.nextSummon = 0;
    stepCombat(s);
    const children = s.enemies.filter((e) => e.owner === parent.id);
    expect(children).toHaveLength(2);
    expect(children.every((e) => e.y === -1)).toBe(true);
    const splitter = spawnEnemy(s, 'splitter', { x: 2.5, y: 0.25 });
    splitter.hp = 0;
    collectDeaths(s);
    const fragments = s.enemies.filter((e) => e.kind === 'split_fragment');
    expect(fragments).toHaveLength(2);
    expect(fragments.every((e) => e.y === 0.25)).toBe(true);
  });
});
