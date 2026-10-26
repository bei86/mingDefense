import { describe, expect, it } from 'vitest';
import { clone, bossName } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { enemyInspection } from './enemy-inspection';

function battle(stageId = 1) {
  return createCombat(
    [
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 11, kind: 'shield_fox', rank: 3, position: { x: 2, y: 4 } },
    ],
    { stageId },
  );
}

describe('暂停敌人详情', () => {
  it('真实Session锁定与生命逐实例一致，暂停读取不改变时钟或RNG', () => {
    const s = new Session();
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
    expect(s.start()).toBeNull();
    for (let i = 0; i < 100 && !s.battle!.enemies.some((enemy) => enemy.target); i++) s.tick();
    s.pause(true);
    const before = JSON.stringify(s);
    const view = enemyInspection(s.battle)!;
    expect(view.enemies.length).toBeGreaterThan(0);
    expect(view.enemies.some((enemy) => enemy.target)).toBe(true);
    for (const enemy of view.enemies) {
      const raw = s.battle!.enemies.find((entry) => entry.id === enemy.id)!;
      expect(enemy.hp).toBe(Math.ceil(raw.hp));
      expect(enemy.target?.id ?? null).toBe(raw.target);
    }
    s.tick();
    expect(enemyInspection(s.battle)).toEqual(view);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('无战斗返回null，无活敌返回空；不包含尚未生成或已退场者', () => {
    expect(enemyInspection(null)).toBeNull();
    const b = battle();
    expect(b.spawns.length).toBeGreaterThan(0);
    expect(enemyInspection(b)).toEqual({ enemies: [], initialId: undefined });
    spawnEnemy(b, 'wolf', { x: 1, y: 0 }).hp = 0;
    expect(enemyInspection(b)!.enemies).toEqual([]);
  });

  it('同种实例按ID区分，首领优先且保留阶段，读取不重排源数组', () => {
    const b = battle(5);
    const first = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    const boss = spawnEnemy(b, 'boss', { x: 3, y: 0 });
    const second = spawnEnemy(b, 'wolf', { x: 2, y: 0 });
    boss.phase2 = true;
    b.enemies.reverse();
    const before = clone(b);
    const view = enemyInspection(b)!;
    expect(view.initialId).toBe(boss.id);
    expect(view.enemies.map((entry) => entry.id)).toEqual([boss.id, first.id, second.id]);
    expect(view.enemies[0]).toMatchObject({ name: bossName(5), phase: '第二阶段' });
    expect(b).toEqual(before);
    boss.phase2 = false;
    expect(enemyInspection(b)!.enemies[0].phase).toBe('第一阶段');
    boss.phase2 = undefined;
    expect(enemyInspection(b)!.enemies[0].phase).toBe('阶段未记录');
  });

  it('当前锁定区分未锁定、存活目标与已失效缓存，返回坐标是副本', () => {
    const b = battle();
    const e = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    expect(enemyInspection(b)!.enemies[0].targetState).toBe('none');
    e.target = 10;
    const selected = enemyInspection(b)!.enemies[0];
    expect(selected.target).toMatchObject({
      id: 10,
      kind: 'ember_mouse',
      rank: 1,
      position: { x: 1, y: 3 },
    });
    selected.target!.position.x = 5;
    expect(b.allies[0].position.x).toBe(1);
    b.allies[0].hp = 0;
    expect(enemyInspection(b)!.enemies[0]).toMatchObject({ target: null, targetState: 'lost' });
    e.target = 999;
    expect(enemyInspection(b)!.enemies[0].targetState).toBe('lost');
  });

  it('旧kind默认狼，生命向上取整；缺失上限和异常上限不伪造', () => {
    const b = battle();
    const e = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    e.kind = undefined;
    e.maxHp = undefined;
    e.hp = 12.1;
    expect(enemyInspection(b)!.enemies[0]).toMatchObject({ kind: 'wolf', hp: 13, maxHp: null });
    e.maxHp = 0;
    expect(enemyInspection(b)!.enemies[0].maxHp).toBeNull();
  });

  it('只显示有效冻结/局部减速/易伤，精确过期边界，0倍率区别于缺失', () => {
    const b = battle();
    const e = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    b.time = 1000;
    Object.assign(e, {
      frozenUntil: 1001,
      slowUntil: 2500,
      vulnerabilityUntil: 3000,
      vulnerabilityPercent: 0,
    });
    expect(enemyInspection(b)!.enemies[0].effects).toEqual([
      { label: '冻结', value: '剩余 0.1 秒' },
      { label: '霜尾缓行', value: '20% · 剩余 1.5 秒' },
      { label: '易伤', value: '0% · 剩余 2 秒' },
    ]);
    e.vulnerabilityPercent = undefined;
    expect(enemyInspection(b)!.enemies[0].effects.at(-1)!.value).toBe('倍率未记录 · 剩余 2 秒');
    b.time = 3000;
    expect(enemyInspection(b)!.enemies[0].effects).toEqual([]);
  });

  it('全场迟滞单列，不冒充局部状态，过期局部仍保留天赋', () => {
    const b = battle();
    spawnEnemy(b, 'wolf', { x: 1, y: 0 }).slowUntil = 0;
    b.progression.buffs.slow = 2;
    expect(enemyInspection(b)!.enemies[0].effects).toEqual([
      { label: '迟滞天赋', value: '移速 -10%' },
    ]);
  });

  it('只列当前实例已有横扫，按due排序、转换行号、区分回响；到期仍列待释放', () => {
    const b = battle(5);
    const boss = spawnEnemy(b, 'boss', { x: 3, y: 0 });
    const wolf = spawnEnemy(b, 'wolf', { x: 1, y: 0 });
    b.time = 1000;
    b.warnings = [
      { source: boss.id, due: 2500, row: 3, echo: true },
      { source: wolf.id, due: 1800, row: 4 },
      { source: boss.id, due: 1000, row: 3 },
    ];
    const allies = [{ id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } }];
    expect(enemyInspection(b)!.enemies[0].warnings).toEqual([
      { row: 4, remainingMs: 0, echo: false, allies },
      { row: 4, remainingMs: 1500, echo: true, allies },
    ]);
    expect(b.warnings[0].due).toBe(2500);
  });

  it('来源及直属活衍生以owner识别，不混同其他召唤者或死亡子怪', () => {
    const b = battle(10);
    const parent = spawnEnemy(b, 'summoner', { x: 1, y: 0 });
    const other = spawnEnemy(b, 'summoner', { x: 2, y: 0 });
    const child = spawnEnemy(b, 'summoned_wolf', { x: 1, y: 1 }, parent.id);
    spawnEnemy(b, 'summoned_wolf', { x: 2, y: 1 }, parent.id).hp = 0;
    spawnEnemy(b, 'summoned_wolf', { x: 3, y: 1 }, other.id);
    const view = enemyInspection(b)!;
    expect(view.enemies.find((e) => e.id === parent.id)!.descendants).toBe(1);
    expect(view.enemies.find((e) => e.id === child.id)!.origin).toContain(`#${parent.id}`);
    b.enemies = b.enemies.filter((e) => e.id !== parent.id);
    expect(enemyInspection(b)!.enemies.find((e) => e.id === child.id)!.origin).toBe(
      `#${parent.id}（来源已退场或未记录）`,
    );
  });

  it('真实召唤和分裂的owner记录可直接读取，冻结时预警由模拟推迟', () => {
    const b = battle(10);
    b.spawns = [];
    const parent = spawnEnemy(b, 'summoner', { x: 1, y: 0 });
    parent.nextSummon = 0;
    stepCombat(b);
    expect(enemyInspection(b)!.enemies.find((e) => e.id === parent.id)!.descendants).toBe(2);
    const splitter = spawnEnemy(b, 'splitter', { x: 2, y: 0 });
    splitter.hp = 0;
    stepCombat(b);
    expect(enemyInspection(b)!.enemies.filter((e) => e.kind === 'split_fragment')).toHaveLength(2);
    const boss = spawnEnemy(b, 'boss', { x: 3, y: 0 });
    boss.frozenUntil = b.time + 500;
    b.warnings.push({ source: boss.id, row: 3, due: b.time + 1000 });
    const before = enemyInspection(b)!.enemies[0].warnings[0];
    stepCombat(b);
    expect(enemyInspection(b)!.enemies[0].warnings[0].remainingMs).toBe(before.remainingMs);
  });
});
