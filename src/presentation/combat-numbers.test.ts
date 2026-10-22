import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { collectDeaths, spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { CombatFeedback } from './combat-feedback';
import { CombatNumbers } from './combat-numbers';

function setup() {
  const session = new Session(20261022);
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  expect(session.start()).toBeNull();
  const battle = session.battle!;
  battle.spawns = [{ at: 100000, x: 1 }];
  const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 3.1 });
  return { session, battle, enemy, ally: battle.allies[0], numbers: new CombatNumbers() };
}

describe('只读伤害飘字', () => {
  it('真实攻击生成生命损失与护盾吸收，不修改规则状态或随机流', () => {
    const { session, battle, ally, numbers } = setup();
    ally.shield = 100;
    ally.shieldExpires = 10000;
    numbers.update(session, 0);
    expect(numbers.active).toEqual([]);
    let damage = false;
    let shield = false;
    for (let i = 1; i <= 35 && session.phase === 'combat'; i++) {
      session.tick();
      const before = clone(session);
      numbers.update(session, i * 50);
      expect(session).toEqual(before);
      damage ||= numbers.active.some((item) => item.team === 'enemy' && item.kind === 'damage');
      shield ||= numbers.active.some((item) => item.team === 'ally' && item.kind === 'shield');
    }
    expect(battle.damageDone).toBeGreaterThan(0);
    expect(battle.report!.units[0].shieldAbsorbed).toBeGreaterThan(0);
    expect(damage).toBe(true);
    expect(shield).toBe(true);
  });

  it('累计承伤不被同采样补血抵消，护盾到期和刷新不产生假吸收', () => {
    const { session, battle, ally, numbers } = setup();
    ally.shield = 100;
    numbers.update(session, 0);
    ally.shield = 0;
    numbers.update(session, 25);
    expect(numbers.active).toEqual([]);
    ally.shield = 200;
    numbers.update(session, 50);
    expect(numbers.active).toEqual([]);
    ally.hp += 10;
    battle.report!.units[0].damageTaken += 12;
    battle.report!.units[0].shieldAbsorbed += 7;
    numbers.update(session, 75);
    expect(numbers.active.map(({ kind, amount }) => ({ kind, amount }))).toEqual([
      { kind: 'damage', amount: 12 },
      { kind: 'shield', amount: 7 },
    ]);
    numbers.update(session, 100);
    expect(numbers.active).toHaveLength(2);
  });

  it('旧战报缺失时按生命净减少回退，不把补血当成伤害', () => {
    const { session, battle, ally, numbers } = setup();
    delete battle.report;
    numbers.update(session, 0);
    ally.hp -= 9;
    numbers.update(session, 25);
    expect(numbers.active[0]).toMatchObject({ team: 'ally', kind: 'damage', amount: 9 });
    ally.hp += 9;
    numbers.update(session, 50);
    expect(numbers.active).toHaveLength(1);
    expect(numbers.active[0].amount).toBe(9);
  });

  it('敌人死亡清理补最后一次剩余生命损失，不重复计数或补播初次见到的敌人', () => {
    const { session, battle, enemy, numbers } = setup();
    enemy.hp = 67;
    numbers.update(session, 0);
    expect(numbers.active).toEqual([]);
    enemy.hp = 34;
    numbers.update(session, 25);
    enemy.hp = 0;
    collectDeaths(battle);
    numbers.update(session, 50);
    expect(numbers.active).toHaveLength(1);
    expect(numbers.active[0]).toMatchObject({ team: 'enemy', amount: 67 });
    numbers.update(session, 75);
    expect(numbers.active[0].amount).toBe(67);
    spawnEnemy(battle, 'wolf', { x: 3, y: 1 }).hp = 1;
    numbers.update(session, 100);
    expect(numbers.active).toHaveLength(1);
  });

  it('短时合并不延长寿命，同目标同类最多两条，过期清空', () => {
    const { session, battle, numbers } = setup();
    numbers.update(session, 0);
    for (const [time, damage] of [
      [100, 1],
      [200, 2],
      [300, 4],
      [500, 8],
    ]) {
      battle.report!.units[0].damageTaken += damage;
      numbers.update(session, time);
    }
    expect(numbers.active.map((item) => item.amount)).toEqual([4, 8]);
    expect(numbers.active.map((item) => item.born)).toEqual([300, 500]);
    numbers.update(session, 1200);
    expect(numbers.active).toEqual([]);
  });

  it('密集群攻最多保留24条且会全部回收', () => {
    const { session, battle, numbers } = setup();
    for (let i = 0; i < 40; i++) spawnEnemy(battle, 'wolf', { x: 2, y: 1 });
    numbers.update(session, 0);
    for (const enemy of battle.enemies) enemy.hp -= 1;
    numbers.update(session, 25);
    expect(numbers.active).toHaveLength(24);
    expect(numbers.active.every((item) => item.amount === 1)).toBe(true);
    numbers.update(session, 725);
    expect(numbers.active).toEqual([]);
  });

  it('隐藏、恢复、回滚、重试及结算都不携带或补播旧数字', () => {
    const { session, battle, enemy, numbers } = setup();
    numbers.update(session, 0);
    enemy.hp -= 10;
    numbers.update(session, 25);
    expect(numbers.active).toHaveLength(1);
    enemy.hp -= 10;
    numbers.update(session, 25, false);
    expect(numbers.active).toEqual([]);
    enemy.hp -= 10;
    numbers.update(session, 50, true);
    expect(numbers.active).toEqual([]);
    battle.time = 100;
    enemy.hp -= 10;
    numbers.update(session, 75);
    expect(numbers.active).toHaveLength(1);
    battle.time = 0;
    numbers.update(session, 100);
    expect(numbers.active).toEqual([]);
    session.backToPreparation();
    numbers.update(session, 125);
    session.start();
    numbers.update(session, 150);
    expect(numbers.active).toEqual([]);
    session.battle!.report!.units[0].damageTaken++;
    numbers.update(session, 175);
    expect(numbers.active).toHaveLength(1);
    session.phase = 'defeat';
    numbers.update(session, 175);
    expect(numbers.active).toEqual([]);
  });

  it('共用反馈时钟，暂停与天赋冻结、倍速推进，离屏清空', () => {
    const { session, battle, enemy } = setup();
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    enemy.hp -= 10;
    feedback.update(session, 25);
    const before = clone(feedback.numbers.active);
    const time = feedback.time;
    session.pause(true);
    feedback.update(session, 5000);
    expect(feedback.time).toBe(time);
    expect(feedback.numbers.active).toEqual(before);
    session.pause(false);
    battle.choices = ['attack'];
    feedback.update(session, 5000);
    expect(feedback.time).toBe(time);
    expect(feedback.numbers.active).toEqual(before);
    battle.choices = [];
    session.speed = 2;
    feedback.update(session, 25);
    expect(feedback.time).toBe(time + 50);
    feedback.update(session, 25, false);
    expect(feedback.numbers.active).toEqual([]);
  });
});
