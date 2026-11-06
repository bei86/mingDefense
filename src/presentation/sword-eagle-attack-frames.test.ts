import { expect, test } from 'vitest';
import { center, config, heroes } from '../game/content';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { GameClock } from '../game/clock';
import { AttackFrames } from './attack-frames';
import { CombatFeedback } from './combat-feedback';

function setup() {
  const session = new Session(20261014, 'm1');
  session.preparation.units = [{ id: 0, kind: 'sword_eagle', rank: 6, position: { x: 1, y: 3 } }];
  session.start();
  const battle = session.battle!;
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 2, y: 2.5 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.frozenUntil = 1e9;
  const frames = new AttackFrames('sword_eagle');
  const feedback = new CombatFeedback();
  frames.update(battle);
  feedback.update(session, 0);
  const tick = () => {
    session.tick();
    const before = JSON.stringify(session);
    frames.update(battle);
    feedback.update(session, 50);
    expect(JSON.stringify(session)).toBe(before);
  };
  return { session, battle, enemy, frames, feedback, tick };
}

test('鹰前三帧随前摇，真实主攻和剑阵产生时才振翼；二次命中与残留剑阵不重复起播', () => {
  const { battle, frames, feedback, tick } = setup();
  const preparation = new Set<number>();
  for (let i = 0; i < 20 && battle.damageDone === 0; i++) {
    tick();
    if (battle.damageDone === 0) preparation.add(frames.frame(0));
  }
  expect(preparation).toEqual(new Set([0, 1, 2]));
  expect(battle.damageDone).toBeGreaterThan(0);
  expect(battle.fields).toHaveLength(1);
  expect(battle.released).toHaveLength(1);
  expect(frames.frame(0)).toBe(3);
  expect(feedback.swordEagleFrame(0)).toBe(3);
  battle.allies[0].cooldown = 1e8;
  const recovery: number[] = [];
  for (let i = 0; i < 5; i++) {
    tick();
    recovery.push(frames.frame(0));
  }
  expect(recovery).toEqual([3, 4, 5, 5, 0]);
  const fieldTicks = Math.ceil(
    Math.max(...heroes.sword_eagle.skills.residueHitOffsetsMs!) / config.runtime.tickMs,
  );
  for (let i = 0; i <= fieldTicks; i++) {
    tick();
    expect(frames.frame(0)).toBe(0);
  }
  expect(battle.released).toHaveLength(0);
  expect(battle.fields).toHaveLength(0);
});

test('目标死亡取消准备、自己死亡、结算、换战斗和回整备均不残留释放', () => {
  const { battle, enemy, frames, tick } = setup();
  tick();
  tick();
  enemy.hp = 0;
  tick();
  expect(frames.frame(0)).toBe(0);
  expect(battle.damageDone).toBe(0);
  expect(battle.fields).toHaveLength(0);
  const live = setup();
  for (let i = 0; i < 20 && live.frames.frame(0) !== 3; i++) live.tick();
  expect(live.frames.frame(0)).toBe(3);
  const late = new AttackFrames('sword_eagle');
  late.update(live.battle);
  expect(late.frame(0)).toBe(0);
  live.battle.result = 'victory';
  expect(live.frames.frame(0)).toBe(0);
  live.battle.result = null;
  live.battle.allies[0].hp = 0;
  live.frames.update(live.battle);
  expect(live.frames.frame(0)).toBe(0);
  live.frames.update(setup().battle);
  expect(live.frames.frame(0)).toBe(0);
  live.session.backToPreparation();
  live.feedback.update(live.session, 0);
  expect(live.feedback.swordEagleFrame(0)).toBe(0);
});

test('鹰按2×2中心区分编号0与同种实例，鼠豚及敌方Flash不触发鹰动作', () => {
  const { battle, frames, tick } = setup();
  battle.allies.push({ ...battle.allies[0], id: 9, position: { x: 3, y: 3 }, cooldown: 1e8 });
  for (let i = 0; i < 20 && frames.frame(0) !== 3; i++) tick();
  expect(frames.frame(0)).toBe(3);
  expect(frames.frame(9)).toBe(0);
  const from = center('sword_eagle', { x: 3, y: 3 });
  for (const [team, kind] of [
    ['enemy', 'sword_eagle'],
    ['ally', 'ember_mouse'],
    ['ally', 'boar'],
  ] as const)
    battle.flashes.push({
      from,
      to: { x: 2, y: 2 },
      at: battle.time - config.runtime.tickMs,
      team,
      kind,
    });
  frames.update(battle);
  expect(frames.frame(9)).toBe(0);
  battle.flashes.push({
    from,
    to: { x: 2, y: 2 },
    at: battle.time - config.runtime.tickMs,
    team: 'ally',
    kind: 'sword_eagle',
  });
  frames.update(battle);
  expect(frames.frame(9)).toBe(3);
  battle.time = 0;
  frames.update(battle);
  expect(frames.frame(9)).toBe(0);
});

test('鹰Feedback暂停/天赋/后台冻结，2倍速随原时钟，受击不延误出手，减少动态固定首帧', () => {
  const { session, battle, feedback } = setup();
  const clock = new GameClock(session);
  clock.advance(0);
  let time = 0;
  for (; time < 1000 && feedback.swordEagleFrame(0) !== 3; ) {
    time += 50;
    clock.advance(time);
    feedback.update(session, 50);
  }
  expect(feedback.swordEagleFrame(0)).toBe(3);
  session.pause(true);
  const before = JSON.stringify(session);
  clock.advance((time += 50));
  feedback.update(session, 50);
  feedback.update(session, 50, false);
  expect(feedback.swordEagleFrame(0)).toBe(3);
  expect(feedback.swordEagleFrame(0, true)).toBe(0);
  expect(feedback.mouseFrame(0)).toBe(0);
  expect(feedback.boarFrame(0)).toBe(0);
  expect(JSON.stringify(session)).toBe(before);
  session.pause(false);
  battle.choices = ['attack'];
  clock.advance((time += 50));
  feedback.update(session, 50);
  expect(feedback.swordEagleFrame(0)).toBe(3);
  battle.choices = [];
  session.speed = 2;
  clock.advance((time += 50));
  feedback.update(session, 50);
  clock.advance((time += 50));
  feedback.update(session, 50);
  expect(feedback.swordEagleFrame(0)).toBe(4);
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  expect(feedback.pose('ally', 0).tint).not.toBe(0xffffff);
  expect(feedback.swordEagleFrame(0)).toBe(4);
  for (let i = 0; i < 30 && feedback.swordEagleFrame(0) !== 3; i++) {
    clock.advance((time += 50));
    feedback.update(session, 50);
  }
  expect(feedback.swordEagleFrame(0)).toBe(3);
});
