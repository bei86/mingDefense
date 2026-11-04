import { expect, test } from 'vitest';
import { selectMouseMotion } from './mouse-motion';
import { CombatFeedback } from './combat-feedback';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';

const base = {
  time: 0,
  dead: false,
  hitAt: -Infinity,
  deadAt: -Infinity,
  attacking: false,
  attackFrame: 0,
  reducedMotion: false,
};

test('待机4帧循环；受击与重伤优先，不改变真实攻击选帧', () => {
  for (const [time, frame] of [
    [0, 0],
    [199, 0],
    [200, 1],
    [400, 2],
    [600, 3],
    [800, 0],
  ])
    expect(selectMouseMotion({ ...base, time })).toEqual({ action: 'idle', frame });
  const attacking = { ...base, attacking: true, attackFrame: 3 };
  expect(selectMouseMotion(attacking)).toEqual({ action: 'attack', frame: 3 });
  for (const [time, frame] of [
    [20, 0],
    [80, 1],
    [140, 2],
  ])
    expect(selectMouseMotion({ ...attacking, hitAt: 20, time })).toEqual({ action: 'hurt', frame });
  expect(selectMouseMotion({ ...attacking, hitAt: 20, time: 200 })).toEqual({
    action: 'attack',
    frame: 3,
  });
  expect(
    selectMouseMotion({ ...attacking, hitAt: 20, time: 140, dead: true, deadAt: 100 }),
  ).toEqual({ action: 'fallen', frame: 0 });
  for (const [time, frame] of [
    [180, 1],
    [260, 2],
    [340, 3],
    [420, 4],
    [900, 4],
  ])
    expect(selectMouseMotion({ ...base, time, dead: true, deadAt: 100 })).toEqual({
      action: 'fallen',
      frame,
    });
});

test('减少动态活体用待机首帧、倒下用末帧；初次读入倒下不补播', () => {
  expect(
    selectMouseMotion({ ...base, time: 500, attacking: true, hitAt: 490, reducedMotion: true }),
  ).toEqual({ action: 'idle', frame: 0 });
  expect(selectMouseMotion({ ...base, dead: true, deadAt: 0, reducedMotion: true })).toEqual({
    action: 'fallen',
    frame: 4,
  });
  expect(selectMouseMotion({ ...base, dead: true })).toEqual({ action: 'fallen', frame: 4 });
});

function setup() {
  const session = new Session(20261014, 'm1');
  session.preparation.units = [{ id: 0, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } }];
  session.start();
  const battle = session.battle!;
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 2.5 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.frozenUntil = 1e9;
  const feedback = new CombatFeedback();
  feedback.update(session, 0);
  return { session, battle, feedback };
}

test('真实Feedback按实例观察生命/护盾变化；再次受击重播，倒下不复活，读取只读', () => {
  const { session, battle, feedback } = setup();
  battle.allies.push({ ...battle.allies[0], id: 9, position: { x: 2, y: 3 } });
  feedback.update(session, 0);
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  expect(feedback.mouseMotion(9).action).toBe('idle');
  feedback.update(session, 70);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'hurt', frame: 1 });
  battle.report!.units.find((unit) => unit.id === 0)!.shieldAbsorbed += 1;
  feedback.update(session, 0);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  battle.allies[0].hp = 0;
  feedback.update(session, 0);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'fallen', frame: 0 });
  for (let i = 0; i < 5; i++) feedback.update(session, 100);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'fallen', frame: 4 });
  const before = JSON.stringify(session);
  for (let i = 0; i < 3; i++) feedback.mouseMotion(0);
  expect(JSON.stringify(session)).toBe(before);
  const late = new CombatFeedback();
  late.update(session, 0);
  expect(late.mouseMotion(0)).toEqual({ action: 'fallen', frame: 4 });
  session.backToPreparation();
  feedback.update(session, 0);
  expect(feedback.mouseMotion(0).action).toBe('idle');
});

test('暂停、选天赋、失焦冻结所有动作；2倍速按表现时钟，整备可待机', () => {
  const { session, battle, feedback } = setup();
  feedback.update(session, 100);
  session.pause(true);
  const motion = feedback.mouseMotion(0);
  feedback.update(session, 100);
  expect(feedback.mouseMotion(0)).toEqual(motion);
  session.pause(false);
  battle.choices = ['attack'];
  feedback.update(session, 100);
  expect(feedback.mouseMotion(0)).toEqual(motion);
  battle.choices = [];
  feedback.update(session, 100, false);
  expect(feedback.mouseMotion(0)).toEqual(motion);
  session.speed = 2;
  feedback.update(session, 100);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'idle', frame: 1 });
  session.backToPreparation();
  feedback.update(session, 100);
  expect(feedback.mouseMotion(0).action).toBe('idle');
});

test('受击覆盖画面时攻击仍按真实时刻释放，恢复后不补播旧攻击；结算倒下取末帧', () => {
  const { session, battle, feedback } = setup();
  session.tick();
  feedback.update(session, 50);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'attack', frame: 0 });
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  for (let i = 0; i < 3; i++) {
    session.tick();
    feedback.update(session, 50);
    expect(feedback.mouseMotion(0).action).toBe('hurt');
  }
  expect(battle.damageDone).toBeGreaterThan(0);
  session.tick();
  feedback.update(session, 50);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'attack', frame: 3 });
  // Repeated damage restarts only the visual hurt state, without queueing past attacks.
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  for (let i = 0; i < 4; i++) {
    session.tick();
    feedback.update(session, 50);
  }
  expect(feedback.mouseMotion(0).action).toBe('idle');
  battle.allies[0].hp = 0;
  battle.result = 'defeat';
  feedback.update(session, 0);
  expect(feedback.mouseMotion(0)).toEqual({ action: 'fallen', frame: 4 });
});
