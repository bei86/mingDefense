import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { CombatFeedback } from './combat-feedback';

function setup() {
  const session = new Session(20261014, 'm1');
  session.preparation.units = [{ id: 0, kind: 'sword_eagle', rank: 3, position: { x: 1, y: 3 } }];
  session.start();
  const battle = session.battle!;
  battle.spawns = [];
  const enemy = spawnEnemy(battle, 'wolf', { x: 2, y: 2.5 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.frozenUntil = 1e9;
  const feedback = new CombatFeedback();
  feedback.update(session, 0);
  const tick = () => {
    session.tick();
    const before = JSON.stringify(session);
    feedback.update(session, 50);
    expect(JSON.stringify(session)).toBe(before);
  };
  return { session, battle, feedback, tick };
}

test('鹰四帧待机循环，生命/护盾受击按实例重置，重伤优先且保持末帧，读取不改Session', () => {
  const { session, battle, feedback } = setup();
  for (let frame = 0; frame < 4; frame++) {
    expect(feedback.swordEagleMotion(0)).toEqual({ action: 'idle', frame });
    feedback.update(session, 100);
    feedback.update(session, 100);
  }
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'idle', frame: 0 });
  battle.allies.push({ ...battle.allies[0], id: 9, position: { x: 3, y: 3 } });
  feedback.update(session, 0);
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  expect(feedback.swordEagleMotion(9).action).toBe('idle');
  feedback.update(session, 70);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 1 });
  battle.report!.units.find((unit) => unit.id === 0)!.shieldAbsorbed += 1;
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  battle.allies[0].hp = 0;
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'fallen', frame: 0 });
  for (let frame = 1; frame <= 4; frame++) {
    feedback.update(session, 80);
    expect(feedback.swordEagleMotion(0)).toEqual({ action: 'fallen', frame });
  }
  feedback.update(session, 100);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'fallen', frame: 4 });
  expect(feedback.swordEagleMotion(0, true)).toEqual({ action: 'fallen', frame: 4 });
  const before = JSON.stringify(session);
  for (let i = 0; i < 3; i++) feedback.swordEagleMotion(0);
  expect(JSON.stringify(session)).toBe(before);
  const late = new CombatFeedback();
  late.update(session, 0);
  expect(late.swordEagleMotion(0)).toEqual({ action: 'fallen', frame: 4 });
  session.backToPreparation();
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0).action).toBe('idle');
});

test('鹰受击覆盖时照常释放主攻与剑阵，恢复不补播，结算直接显示稳定休息姿态', () => {
  const { session, battle, feedback, tick } = setup();
  tick();
  const due = battle.attacks.find((attack) => attack.team === 'ally' && attack.source === 0)!.due;
  while (battle.time < due) tick();
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  tick();
  expect(battle.damageDone).toBeGreaterThan(0);
  expect(battle.fields).toHaveLength(1);
  expect(feedback.swordEagleFrame(0)).toBe(3);
  expect(feedback.swordEagleMotion(0).action).toBe('hurt');
  battle.allies[0].cooldown = 1e8;
  for (let i = 0; i < 5; i++) tick();
  expect(feedback.swordEagleMotion(0).action).toBe('idle');
  expect(feedback.swordEagleMotion(0, true)).toEqual({ action: 'idle', frame: 0 });
  battle.allies[0].hp = 0;
  feedback.update(session, 0);
  battle.result = 'defeat';
  feedback.update(session, 0);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'fallen', frame: 4 });
});

test('鹰待机/受击在暂停、天赋、后台冻结，倍速沿既有时钟，减少动态不影响下一次正常读取', () => {
  const { session, battle, feedback } = setup();
  feedback.update(session, 100);
  const idle = feedback.swordEagleMotion(0);
  session.pause(true);
  feedback.update(session, 100);
  expect(feedback.swordEagleMotion(0)).toEqual(idle);
  session.pause(false);
  battle.choices = ['attack'];
  feedback.update(session, 100);
  expect(feedback.swordEagleMotion(0)).toEqual(idle);
  battle.choices = [];
  feedback.update(session, 100, false);
  expect(feedback.swordEagleMotion(0)).toEqual(idle);
  session.speed = 2;
  feedback.update(session, 100);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'idle', frame: 1 });
  expect(feedback.swordEagleMotion(0, true)).toEqual({ action: 'idle', frame: 0 });
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'idle', frame: 1 });
  battle.allies[0].hp -= 1;
  feedback.update(session, 0);
  session.pause(true);
  feedback.update(session, 100);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 0 });
  session.pause(false);
  feedback.update(session, 30);
  expect(feedback.swordEagleMotion(0)).toEqual({ action: 'hurt', frame: 1 });
});
