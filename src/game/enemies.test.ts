import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from './combat';
import { collectDeaths, releaseAttack, spawnEnemy } from './combat-skills';
import { bossDefinition, config, enemyDefinitions, stages, type EnemyKind } from './content';
import type { Packet } from './combat-model';

function arena(stageId = 6) {
  const s = createCombat(
    [
      { id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 2 } },
      { id: 2, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 4 } },
    ],
    { stageId },
  );
  s.spawns = [{ at: 100000, x: 0 }];
  for (const a of s.allies) a.cooldown = 100000;
  return s;
}

describe('补齐敌人', () => {
  it('远程在四格内停步，仍只伤前排，即使后排距离更近', () => {
    const s = arena();
    const e = spawnEnemy(s, 'ranged', { x: 1.5, y: 4 });
    const y = e.y;
    for (let i = 0; i < 6; i++) stepCombat(s);
    expect(e.y).toBe(y);
    expect(s.allies[0].hp).toBeLessThan(s.allies[0].maxHp);
    expect(s.allies[1].hp).toBe(s.allies[1].maxHp);
  });
  it('召唤计时从出生开始，每位父实例最多六只，无经验与能量', () => {
    const s = arena(8);
    const parents = [0, 1].map((x) => spawnEnemy(s, 'summoner', { x, y: 0 }));
    const first = enemyDefinitions.summoner.skills.firstSummonDelayMs!;
    s.time = first - 50;
    stepCombat(s);
    expect(s.enemies).toHaveLength(2);
    for (const time of [first, first + 20000, first + 40000, first + 60000]) {
      s.time = time;
      stepCombat(s);
    }
    for (const p of parents) expect(s.enemies.filter((e) => e.owner === p.id)).toHaveLength(6);
    const children = s.enemies.filter((e) => e.kind === 'summoned_wolf');
    const child = children[0];
    child.hp = 0;
    collectDeaths(s);
    expect(s.xpEarned).toBe(0);
    expect(s.energy).toBe(0);
    expect(child.maxHp).toBe(Math.round(120 * stages[7].hpMultiplier));
    s.time = first + 80000;
    stepCombat(s);
    for (const p of parents) expect(s.enemies.filter((e) => e.owner === p.id)).toHaveLength(6);
    expect(
      s.enemies.filter((e) => e.owner === child.owner && e.born === first + 80000),
    ).toHaveLength(1);
  });
  it('冻结推迟召唤，解冻不补发积压波次；父死不再召唤但孩子保留', () => {
    const s = arena(8);
    const p = spawnEnemy(s, 'summoner', { x: 0, y: 0 });
    s.time = enemyDefinitions.summoner.skills.firstSummonDelayMs!;
    p.frozenUntil = s.time + 100;
    stepCombat(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === p.id)).toHaveLength(2);
    p.hp = 0;
    collectDeaths(s);
    s.time = 90000;
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === p.id)).toHaveLength(2);
  });
  it('死亡只分裂一次，孩子不递归并给独立2经验/2灵气', () => {
    const s = arena(9);
    const parent = spawnEnemy(s, 'splitter', { x: 2, y: 0 });
    parent.hp = 0;
    collectDeaths(s);
    collectDeaths(s);
    expect(s.enemies.map((e) => e.kind)).toEqual(['split_fragment', 'split_fragment']);
    expect(s.enemies.every((e) => e.maxHp === Math.round(100 * stages[8].hpMultiplier))).toBe(true);
    expect(s.xpEarned).toBe(8);
    expect(s.energy).toBe(5);
    s.enemies.forEach((e) => {
      e.hp = 0;
    });
    collectDeaths(s);
    expect(s.enemies).toHaveLength(0);
    expect(s.xpEarned).toBe(12);
    expect(s.energy).toBe(9);
  });
  it('同批击杀父怪后孩子存活且不立刻行动，清完孩子前不胜利', () => {
    const s = arena(9);
    s.spawns = [];
    const e = spawnEnemy(s, 'splitter', { x: 1.5, y: 4 });
    e.hp = 1;
    s.attacks = [{ team: 'ally', source: 2, target: e.id, ordinal: 1, due: 0 }];
    stepCombat(s);
    expect(s.enemies).toHaveLength(2);
    expect(s.enemies.every((child) => child.hp === child.maxHp)).toBe(true);
    expect(s.attacks).toHaveLength(0);
    expect(s.result).toBeNull();
    s.enemies.forEach((child) => {
      child.hp = 0;
    });
    stepCombat(s);
    expect(s.result).toBe('victory');
  });
  it('狼六关起按存活十秒获得5%攻击，最多六层，出生晚不会继承全局时间', () => {
    for (const stage of [5, 6]) {
      const s = arena(stage);
      const e = spawnEnemy(s, 'wolf', { x: 0, y: 0 });
      const amounts: number[] = [];
      for (const time of [9999, 10000, 60000, 100000]) {
        s.time = time;
        const packets: Packet[] = [];
        releaseAttack(
          s,
          { source: e.id, target: 1, team: 'enemy', ordinal: 0, due: time },
          packets,
        );
        amounts.push(packets[0].damage);
      }
      const base = Math.round(14 * stages[stage - 1].attackMultiplier);
      expect(amounts).toEqual(
        stage === 5
          ? [base, base, base, base]
          : [base, Math.floor(base * 1.05), Math.floor(base * 1.3), Math.floor(base * 1.3)],
      );
      const late = spawnEnemy(s, 'wolf', { x: 0, y: 0 });
      const packets: Packet[] = [];
      releaseAttack(
        s,
        { source: late.id, target: 1, team: 'enemy', ordinal: 0, due: s.time },
        packets,
      );
      expect(packets[0].damage).toBe(base);
    }
  });
  it('两个首领隔离配置，第十关从一阶段就召唤，第五关仍等到低血', () => {
    expect(bossDefinition(5)).toEqual(config.boss);
    const a = arena(5);
    const b = arena(10);
    expect(spawnEnemy(a, 'boss', { x: 0, y: 0 }).hp).toBe(72000);
    expect(spawnEnemy(b, 'boss', { x: 0, y: 0 }).hp).toBe(240000);
    a.time = b.time = 14000;
    stepCombat(a);
    stepCombat(b);
    expect(a.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(0);
    expect(b.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(3);
    b.enemies.find((e) => e.kind === 'boss')!.hp = 120000;
    b.time = 15000;
    stepCombat(b);
    expect(b.enemies.find((e) => e.kind === 'boss')!.phase2).toBe(true);
    expect(b.enemies.find((e) => e.kind === 'boss')!.nextSummon).toBe(28000);
    for (const time of [28000, 42000, 56000]) {
      b.time = time;
      stepCombat(b);
    }
    expect(b.enemies.filter((e) => e.kind === 'summoned_wolf')).toHaveLength(9);
  });
  it('第十关使用自己的横扫伤害和预警；冻结同时推迟技能与召唤', () => {
    const s = arena(10);
    const boss = spawnEnemy(s, 'boss', { x: 0, y: 0 });
    boss.cooldown = 100000;
    boss.nextSummon = 16000;
    s.time = 16000;
    boss.frozenUntil = 16100;
    stepCombat(s);
    stepCombat(s);
    expect(s.warnings).toHaveLength(0);
    expect(s.enemies).toHaveLength(1);
    stepCombat(s);
    expect(s.enemies.filter((e) => e.owner === boss.id)).toHaveLength(3);
    expect(s.warnings).toEqual([{ source: boss.id, row: 2, due: 17700 }]);
    s.time = 17700;
    stepCombat(s);
    expect(s.allies[0].maxHp - s.allies[0].hp).toBe(125);
    expect(s.allies[1].hp).toBe(s.allies[1].maxHp);
  });
  it.each<EnemyKind>(['summoner', 'ranged', 'splitter', 'split_fragment'])(
    '%s死亡后取消前摇，不攻击后排',
    (kind) => {
      const s = arena(9);
      const e = spawnEnemy(s, kind, { x: 1.5, y: 4 });
      e.hp = 0;
      const packets: Packet[] = [];
      releaseAttack(s, { team: 'enemy', source: e.id, target: 2, ordinal: 0, due: 0 }, packets);
      expect(packets).toHaveLength(0);
    },
  );
});
