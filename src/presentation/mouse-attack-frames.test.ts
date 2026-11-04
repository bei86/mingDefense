import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { GameClock } from '../game/clock';
import { CombatFeedback } from './combat-feedback';
import { MouseAttackFrames } from './mouse-attack-frames';

function setup() {
  const session = new Session(20261014, 'm1');
  session.preparation.units = [{ id: 0, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } }];
  session.start();
  const battle = session.battle!;
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 2.5 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.frozenUntil = 1e9;
  const frames = new MouseAttackFrames();
  frames.update(battle);
  const tick = () => {
    session.tick();
    frames.update(battle);
  };
  return { session, battle, enemy, frames, tick };
}

test('真实攻击准备0/1/2后由释放触发3，收势4/5后复位；重复读取不改Session/RNG', () => {
  const { session, battle, frames, tick } = setup();
  tick();
  expect(frames.frame(0)).toBe(0);
  tick();
  expect(frames.frame(0)).toBe(1);
  tick();
  expect(frames.frame(0)).toBe(2);
  expect(battle.damageDone).toBe(0);
  tick();
  expect(battle.damageDone).toBeGreaterThan(0);
  expect(frames.frame(0)).toBe(3);
  const before = JSON.stringify(session);
  frames.update(battle);
  expect(frames.frame(0)).toBe(3);
  expect(JSON.stringify(session)).toBe(before);
  tick();
  expect(frames.frame(0)).toBe(3);
  tick();
  expect(frames.frame(0)).toBe(4);
  tick();
  expect(frames.frame(0)).toBe(5);
  tick();
  tick();
  expect(frames.frame(0)).toBe(0);
  for (let i = 0; i < 20 && frames.frame(0) !== 3; i++) tick();
  expect(frames.frame(0)).toBe(3);
});

test('目标先死取消准备，不因前摇到期假装释放；自身倒下立即回基准', () => {
  const { battle, enemy, frames, tick } = setup();
  tick();
  tick();
  expect(frames.frame(0)).toBe(1);
  enemy.hp = 0;
  tick();
  expect(frames.frame(0)).toBe(0);
  tick();
  expect(frames.frame(0)).toBe(0);
  expect(battle.damageDone).toBe(0);
  const active = setup();
  for (let i = 0; i < 4; i++) active.tick();
  expect(active.frames.frame(0)).toBe(3);
  active.battle.allies[0].hp = 0;
  active.frames.update(active.battle);
  expect(active.frames.frame(0)).toBe(0);
});

test('同名实例独立，编号0有效，敌方或其他技能Flash不能触发鼠动作', () => {
  const { battle, frames, tick } = setup();
  battle.allies.push({ ...battle.allies[0], id: 9, position: { x: 2, y: 3 }, cooldown: 1e5 });
  for (let i = 0; i < 4; i++) tick();
  expect(frames.frame(0)).toBe(3);
  expect(frames.frame(9)).toBe(0);
  for (const team of ['enemy', 'ally'] as const)
    battle.flashes.push({
      from: { x: 2.5, y: 3.5 },
      to: { x: 2, y: 2 },
      at: battle.time,
      team,
      kind: 'boar',
    });
  frames.update(battle);
  expect(frames.frame(9)).toBe(0);
});

test('旧Flash初始化不重播，真实新事件才播放，回滚/空场/换战斗清旧动作', () => {
  const { battle, frames, tick } = setup();
  for (let i = 0; i < 4; i++) tick();
  expect(frames.frame(0)).toBe(3);
  const late = new MouseAttackFrames();
  late.update(battle);
  expect(late.frame(0)).toBe(0);
  battle.time = 0;
  frames.update(battle);
  expect(frames.frame(0)).toBe(0);
  frames.update(null);
  expect(frames.frame(0)).toBe(0);
  frames.update(setup().battle);
  expect(frames.frame(0)).toBe(0);
});

test('Feedback组合读取只读；暂停、待选天赋、失焦不推进，2倍速随真实模拟', () => {
  const { session, battle } = setup();
  const feedback = new CombatFeedback();
  const clock = new GameClock(session);
  feedback.update(session, 0);
  clock.advance(0);
  for (const time of [50, 100, 150, 200]) {
    clock.advance(time);
    feedback.update(session, 50);
  }
  expect(feedback.mouseFrame(0)).toBe(3);
  session.pause(true);
  const before = JSON.stringify(session);
  clock.advance(250);
  feedback.update(session, 50);
  expect(feedback.mouseFrame(0)).toBe(3);
  expect(JSON.stringify(session)).toBe(before);
  feedback.update(session, 50, false);
  expect(feedback.mouseFrame(0)).toBe(3);
  expect(feedback.mouseFrame(0, true)).toBe(0);
  session.pause(false);
  battle.choices = ['attack'];
  clock.advance(300);
  feedback.update(session, 50);
  expect(feedback.mouseFrame(0)).toBe(3);
  battle.choices = [];
  session.speed = 2;
  clock.advance(350);
  feedback.update(session, 50);
  expect(feedback.mouseFrame(0)).toBe(3);
  clock.advance(400);
  feedback.update(session, 50);
  expect(feedback.mouseFrame(0)).toBe(4);
  session.backToPreparation();
  feedback.update(session, 0);
  expect(feedback.mouseFrame(0)).toBe(0);
});
