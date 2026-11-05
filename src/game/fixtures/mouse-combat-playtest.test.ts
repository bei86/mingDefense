import { expect, test } from 'vitest';
import { CombatFeedback } from '../../presentation/combat-feedback';
import { config } from '../content';
import { waveSpawns } from '../combat';
import { mouseCombatPlaytest } from './mouse-combat-playtest';

test('正常第1关战斗可观察四动作，前排倒下时后排仍在战斗', () => {
  const session = mouseCombatPlaytest();
  const control = mouseCombatPlaytest();
  const feedback = new CombatFeedback();
  const seen = new Set<string>();
  feedback.update(session, 0);
  seen.add(feedback.mouseMotion(5).action);
  expect(session.start()).toBeNull();
  expect(control.start()).toBeNull();
  expect(session.battle!.spawns).toEqual(waveSpawns(1));
  let firstFall: number | null = null;
  let rearAttackedAfterFall = false;
  let fallenLastFrame = false;
  for (let i = 0; i < 2400 && session.phase === 'combat'; i++) {
    if (session.hasChoices) {
      const buff = session.battle!.choices[0];
      session.chooseBuff(buff);
      control.chooseBuff(buff);
    }
    session.tick();
    control.tick();
    feedback.update(session, config.runtime.tickMs);
    for (const unit of session.battle!.allies) {
      const motion = feedback.mouseMotion(unit.id);
      seen.add(motion.action);
      if (unit.id === 5 && unit.hp <= 0 && firstFall === null) {
        firstFall = session.battle!.time;
        expect(session.phase).toBe('combat');
        expect(session.battle!.allies.find((ally) => ally.id === 6)!.hp).toBeGreaterThan(0);
      }
      if (unit.id === 5 && motion.action === 'fallen' && motion.frame === 4) fallenLastFrame = true;
      if (unit.id === 6 && firstFall !== null && motion.action === 'attack')
        rearAttackedAfterFall = true;
    }
  }
  expect([...seen].sort()).toEqual(['attack', 'fallen', 'hurt', 'idle']);
  expect(firstFall).not.toBeNull();
  expect(rearAttackedAfterFall).toBe(true);
  expect(fallenLastFrame).toBe(true);
  expect(session.battle!.damageDone).toBeGreaterThan(0);
  expect(session.battle!.damageTaken).toBeGreaterThan(0);
  expect(session.phase).not.toBe('combat');
  // Compare the complete mutable Session, including simulation RNG, with no presentation reader.
  expect(JSON.stringify(session)).toBe(JSON.stringify(control));
});

test('暂停冻结表现，2倍速复用时钟，重试和重置恢复同一个人工开局', () => {
  const session = mouseCombatPlaytest();
  const opening = session.exportSave();
  expect(session.preparation.units.map((unit) => unit.kind)).toEqual([
    'ember_mouse',
    'ember_mouse',
  ]);
  expect(session.preparation.unlocked).toHaveLength(36);
  session.start();
  const feedback = new CombatFeedback();
  feedback.update(session, 0);
  session.pause(true);
  const before = JSON.stringify(session);
  const pose = feedback.mouseMotion(5);
  session.tick();
  feedback.update(session, 100);
  expect(feedback.mouseMotion(5)).toEqual(pose);
  expect(JSON.stringify(session)).toBe(before);
  session.pause(false);
  session.speed = 2;
  feedback.update(session, 100);
  expect(feedback.mouseMotion(5)).toEqual({ action: 'idle', frame: 1 });
  session.preparation.currency += 20;
  expect(session.retry()).toBeNull();
  expect(session.battle!.time).toBe(0);
  session.backToPreparation();
  expect(session.exportSave()).toEqual(opening);
  session.preparation.units.pop();
  session.reset();
  expect(session.exportSave()).toEqual(opening);
  const reset = JSON.stringify(session);
  expect(session.nextStage()).toContain('仅用于烬灵鼠');
  expect(JSON.stringify(session)).toBe(reset);
});

test('结算返回整备恢复原样板，不携带临时收入或天赋', () => {
  const session = mouseCombatPlaytest();
  const opening = session.exportSave();
  session.start();
  session.phase = 'victory';
  session.preparation.currency += 100;
  session.preparation.rewardedStages.push(1);
  session.preparation.progression.buffs.attack = 2;
  const completed = JSON.stringify(session);
  expect(session.nextStage()).toContain('仅用于烬灵鼠');
  expect(JSON.stringify(session)).toBe(completed);
  session.backToPreparation();
  expect(session.exportSave()).toEqual(opening);
});
