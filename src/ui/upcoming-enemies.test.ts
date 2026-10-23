import { describe, expect, it } from 'vitest';
import { config, stages } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { arrivalLabel, upcomingEnemies } from './upcoming-enemies';

describe('暂停后的固定敌袭队列', () => {
  it('无战斗返回null，空队列仅表示无固定出怪，不代表胜利', () => {
    expect(upcomingEnemies(null)).toBeNull();
    const battle = createCombat([]);
    battle.spawns = [];
    spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
    expect(upcomingEnemies(battle)).toEqual({
      remaining: 0,
      counts: [],
      next: [],
      hiddenCount: 0,
      ended: false,
    });
    expect(battle.result).toBeNull();
    battle.result = 'defeat';
    expect(upcomingEnemies(battle)!.ended).toBe(true);
  });

  it('50关真实固定队列数量含首领，摘要守恒，最多显示8只且不改原队列', () => {
    for (const stage of stages) {
      const battle = createCombat([], { stageId: stage.id });
      const before = JSON.stringify(battle);
      const view = upcomingEnemies(battle)!;
      const total = stage.waves.reduce(
        (sum, wave) => sum + Object.values(wave.enemies).reduce((n, count) => n + count, 0),
        stage.bossId ? 1 : 0,
      );
      expect(view.remaining, `stage${stage.id}`).toBe(total);
      expect(view.counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(total);
      expect(view.next).toHaveLength(Math.min(8, total));
      expect(view.next.length + view.hiddenCount).toBe(total);
      expect(view.next.map((entry) => entry.kind)).toEqual(
        battle.spawns.slice(0, 8).map((spawn) => spawn.kind ?? 'wolf'),
      );
      expect(JSON.stringify(battle)).toBe(before);
    }
  });

  it('以游标而非时间判断未执行：同刻首领/杂兵保持队列顺序，已到时显示待出场', () => {
    const battle = createCombat([], { stageId: 50 });
    battle.spawns = [
      { at: 0, x: 3.5, kind: 'boss' },
      { at: 0, x: 1.5, kind: 'wolf' },
      { at: 1000, x: 5.5, kind: 'ranged' },
    ];
    const start = upcomingEnemies(battle)!;
    expect(start.next[0]).toMatchObject({
      index: 0,
      kind: 'boss',
      name: '镇渊妖君',
      remainingMs: 0,
      column: 4,
    });
    expect(start.next[1]).toMatchObject({ index: 1, kind: 'wolf', remainingMs: 0, column: 2 });
    battle.spawnIndex = 1;
    battle.time = 1000;
    const view = upcomingEnemies(battle)!;
    expect(view.remaining).toBe(2);
    expect(view.next.map((entry) => entry.kind)).toEqual(['wolf', 'ranged']);
    expect(view.next.map((entry) => entry.remainingMs)).toEqual([0, 0]);
    expect(view.next[1].column).toBe(6);
  });

  it('旧队列未写kind按wolf，场上召唤、分裂、已死亡实例不混入剩余统计', () => {
    const battle = createCombat([]);
    battle.spawns = [
      { at: 5000, x: 1.5 },
      { at: 6000, x: 3.5, kind: 'ranged' },
    ];
    spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, 20);
    spawnEnemy(battle, 'split_fragment', { x: 1, y: 0 }, 21);
    spawnEnemy(battle, 'wolf', { x: 1, y: 0 }).hp = 0;
    expect(upcomingEnemies(battle)).toMatchObject({
      remaining: 2,
      counts: [
        { kind: 'wolf', name: '奔雷狼', count: 1 },
        { kind: 'ranged', name: '翎羽客', count: 1 },
      ],
      hiddenCount: 0,
    });
  });

  it('最后一只和全部出场按游标收敛，不以击杀数代替出场数', () => {
    const battle = createCombat([]);
    battle.spawnIndex = battle.spawns.length - 1;
    battle.kills = 500;
    const view = upcomingEnemies(battle)!;
    expect(view.remaining).toBe(1);
    expect(view.next[0].index).toBe(battle.spawns.length - 1);
    expect(view.hiddenCount).toBe(0);
    battle.spawnIndex++;
    expect(upcomingEnemies(battle)).toMatchObject({
      remaining: 0,
      next: [],
      counts: [],
      ended: false,
    });
  });

  it.each(['victory', 'defeat'] as const)(
    '结束态%s保留未执行的历史计划，但明确不再继续出场',
    (result) => {
      const battle = createCombat([]);
      battle.result = result;
      expect(upcomingEnemies(battle)).toMatchObject({
        ended: true,
        remaining: battle.spawns.length,
      });
    },
  );

  it('真实Session暂停读取不改RNG/候选/时钟/游标，恢复后与实际下一次出场一致', () => {
    const session = new Session();
    expect(session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
    expect(session.start()).toBeNull();
    session.pause(true);
    const before = JSON.stringify(session);
    const view = upcomingEnemies(session.battle)!;
    expect(view.next[0]).toMatchObject({ index: 0, at: 0, remainingMs: 0 });
    session.tick();
    expect(upcomingEnemies(session.battle)).toEqual(view);
    expect(JSON.stringify(session)).toBe(before);
    session.pause(false);
    session.tick();
    expect(session.battle!.spawnIndex).toBe(1);
    expect(session.battle!.enemies[0].kind).toBe(view.next[0].kind);
    expect(upcomingEnemies(session.battle)!.remaining).toBe(view.remaining - 1);
    expect(upcomingEnemies(session.battle)!.next[0].remainingMs).toBe(
      view.next[1].at - config.runtime.tickMs,
    );
  });

  it('同一时刻多个计划都由真实step执行，读取不生成额外出怪或消耗随机', () => {
    const battle = createCombat(
      [{ id: 1, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 5 } }],
      { stageId: 5 },
    );
    const before = upcomingEnemies(battle)!;
    expect(before.next[0].kind).toBe('boss');
    const due = before.next.filter((entry) => entry.at === 0);
    expect(due.length).toBeGreaterThan(1);
    stepCombat(battle);
    expect(battle.spawnIndex).toBe(due.length);
    expect(battle.enemies.map((enemy) => enemy.kind)).toEqual(due.map((entry) => entry.kind));
  });

  it.each<[number, string]>([
    [0, '待出场'],
    [-50, '待出场'],
    [1, '0.1 秒后'],
    [50, '0.1 秒后'],
    [950, '1 秒后'],
    [1000, '1 秒后'],
    [1050, '1.1 秒后'],
  ])('剩余%ims不显示负数或向下低估，格式为%s', (ms, label) => {
    expect(arrivalLabel(ms)).toBe(label);
  });
});
