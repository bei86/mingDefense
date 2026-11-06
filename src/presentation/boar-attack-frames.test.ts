import { expect, test } from 'vitest';
import { center, config } from '../game/content';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { GameClock } from '../game/clock';
import { AttackFrames } from './attack-frames';
import { CombatFeedback } from './combat-feedback';

function setup() {
  const session = new Session(20261014, 'm1');
  session.preparation.units = [{ id: 0, kind: 'boar', rank: 3, position: { x: 1, y: 3 } }];
  session.start();
  const battle = session.battle!;
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 2, y: 2.5 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.frozenUntil = 1e9;
  const frames = new AttackFrames('boar');
  frames.update(battle);
  const tick = () => {
    session.tick();
    const before = JSON.stringify(session);
    frames.update(battle);
    expect(JSON.stringify(session)).toBe(before);
  };
  return { session, battle, enemy, frames, tick };
}

test('岩甲豚真实前摇只显示0/1/2，真实释放才显示3，收势4/5后复位', () => {
  const { battle, frames, tick } = setup();
  const preparation: number[] = [];
  for (let i = 0; i < 10 && battle.damageDone === 0; i++) {
    tick();
    if (battle.damageDone === 0) preparation.push(frames.frame(0));
  }
  expect(new Set(preparation)).toEqual(new Set([0, 1, 2]));
  expect(battle.damageDone).toBeGreaterThan(0);
  expect(frames.frame(0)).toBe(3);
  const recovery: number[] = [];
  for (let i = 0; i < 5; i++) {
    tick();
    recovery.push(frames.frame(0));
  }
  expect(recovery).toEqual([3, 4, 5, 5, 0]);
  // Repeated attacks include rank-3 criticals without creating extra animation releases.
  const releases: number[] = [];
  for (let i = 0; i < 60; i++) {
    const damage = battle.damageDone;
    tick();
    if (battle.damageDone > damage) releases.push(frames.frame(0));
  }
  expect(releases.length).toBeGreaterThanOrEqual(2);
  expect(releases.every((frame) => frame === 3)).toBe(true);
});

test('取消前摇、自己死亡、结算及换战斗不能残留或伪造出手', () => {
  const { battle, enemy, frames, tick } = setup();
  tick();
  tick();
  enemy.hp = 0;
  tick();
  expect(frames.frame(0)).toBe(0);
  expect(battle.damageDone).toBe(0);

  const live = setup();
  for (let i = 0; i < 5; i++) live.tick();
  expect(live.frames.frame(0)).toBe(3);
  const late = new AttackFrames('boar');
  late.update(live.battle);
  expect(late.frame(0)).toBe(0);
  live.battle.result = 'victory';
  expect(live.frames.frame(0)).toBe(0);
  live.battle.result = null;
  live.battle.allies[0].hp = 0;
  live.frames.update(live.battle);
  expect(live.frames.frame(0)).toBe(0);
  live.frames.update(null);
  live.frames.update(setup().battle);
  expect(live.frames.frame(0)).toBe(0);
});

test('编号0与两格中心正确匹配，同种实例与其他种类事件隔离', () => {
  const { battle, frames, tick } = setup();
  battle.allies.push({ ...battle.allies[0], id: 9, position: { x: 3, y: 3 }, cooldown: 1e5 });
  for (let i = 0; i < 5; i++) tick();
  expect(frames.frame(0)).toBe(3);
  expect(frames.frame(9)).toBe(0);
  const from = center('boar', { x: 3, y: 3 });
  for (const [team, kind] of [
    ['enemy', 'boar'],
    ['ally', 'ember_mouse'],
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
    kind: 'boar',
  });
  frames.update(battle);
  expect(frames.frame(9)).toBe(3);
  battle.time = 0;
  frames.update(battle);
  expect(frames.frame(9)).toBe(0);
});

test('岩甲豚Feedback跟随暂停、选天赋与2倍速；减少动态固定基准，读取不改模拟', () => {
  const { session, battle } = setup();
  const feedback = new CombatFeedback();
  const clock = new GameClock(session);
  feedback.update(session, 0);
  clock.advance(0);
  for (const time of [50, 100, 150, 200, 250]) {
    clock.advance(time);
    feedback.update(session, 50);
  }
  expect(feedback.boarFrame(0)).toBe(3);
  session.pause(true);
  const before = JSON.stringify(session);
  clock.advance(300);
  feedback.update(session, 50);
  feedback.update(session, 50, false);
  expect(feedback.boarFrame(0)).toBe(3);
  expect(feedback.boarFrame(0, true)).toBe(0);
  expect(feedback.mouseFrame(0)).toBe(0);
  expect(JSON.stringify(session)).toBe(before);
  session.pause(false);
  battle.choices = ['attack'];
  clock.advance(350);
  feedback.update(session, 50);
  expect(feedback.boarFrame(0)).toBe(3);
  battle.choices = [];
  session.speed = 2;
  clock.advance(400);
  feedback.update(session, 50);
  clock.advance(450);
  feedback.update(session, 50);
  expect(feedback.boarFrame(0)).toBe(4);
  session.backToPreparation();
  feedback.update(session, 0);
  expect(feedback.boarFrame(0)).toBe(0);
});
