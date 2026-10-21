import { expect, test } from 'vitest';
import { clone, config } from './content';
import v15 from '../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';
import checkpoint from './fixtures/calibration-20-checkpoint.json';
import checkpoint25 from './fixtures/calibration-25-checkpoint.json';
import checkpoint30 from './fixtures/calibration-30-checkpoint.json';
import { Session } from './session';
import { validSave } from './persistence';

test('v20三格校准只修改授权数值，保留其余完整配置 P', () => {
  const expected = clone(v15);
  expected.contentVersion = 'prototype-2026-10-21-v20';
  expected.status = 'prototype-forty-stages-v20';
  expected.waves.spawnRow = -3;
  expected.enemies.find((e) => e.id === 'ranged')!.hitDamage = 12;
  expected.thirdBoss.hp = 357500;
  expected.fourthBoss.hp = 522500;
  expected.fifthBoss.hp = 800000;
  expected.stages[24].waves.forEach((wave) => {
    Object.assign(wave.enemies, { ranged: 2 });
  });
  expected.stages[24].waves[1].atMs = 6000;
  expected.stages[27].hpMultiplier = 37.8;
  expected.stages[28].attackMultiplier = 6.5;
  expected.sixthBoss.hp = 1050000;
  expected.stages[29].waves.forEach((wave) => {
    Object.assign(wave.enemies, { ranged: 1 });
  });
  expected.stages[29].waves[1].atMs = 5000;
  expect(config).toEqual(expected);
});

test.each([
  { checkpoint: checkpoint25, stage: 25, time: 78000, hp: 8089, maxHp: 16456, money: 217 },
  { checkpoint: checkpoint30, stage: 30, time: 101000, hp: 5599, maxHp: 17251, money: 266 },
])(
  '第$stage关当前经济检查点可中止重试、选择天赋、结算及继续下关且不重复奖励',
  ({ checkpoint, stage, time, hp, maxHp, money }) => {
    if (!validSave(checkpoint)) throw new Error(`Invalid stage-${stage} checkpoint`);
    const session = Session.restore(checkpoint);
    const before = clone(session.preparation);
    expect(session.start()).toBeNull();
    for (let i = 0; i < 200; i++) session.tick();
    session.backToPreparation();
    expect(session.preparation).toEqual(before);
    expect(session.start()).toBeNull();
    const priority: string[] = [
      'attack',
      'attack_speed',
      'boar_attack',
      'bear_attack',
      'monkey_vulnerability',
      'eagle_residue',
      'health',
      'slow',
      'range',
      'reward',
    ];
    let choices = 0;
    for (let i = 0; i < 5000 && (session.phase === 'combat' || session.hasChoices); i++) {
      if (session.hasChoices) {
        const score = (id: string) => (priority.includes(id) ? priority.indexOf(id) : 99);
        session.chooseBuff([...session.battle!.choices].sort((a, b) => score(a) - score(b))[0]);
        choices++;
      } else session.tick();
    }
    expect(choices).toBe(1);
    expect(session.phase).toBe('victory');
    expect(session.battle!.time).toBe(time);
    expect(session.totalHealth()).toBe(hp);
    expect(session.battle!.report!.boostedMs).toBe(0);
    if (stage === 30) {
      expect(session.battle!.progression.buffs.attack_speed).toBe(5);
      expect(session.battle!.damageDone).toBe(1144080);
      expect(session.battle!.damageTaken).toBe(11652);
      expect(session.battle!.kills).toBe(23);
      expect(session.lastReward + session.lastIncome + session.lastBonus).toBe(254);
    }
    const save = session.exportSave();
    expect(validSave(save)).toBe(true);
    const restored = Session.restore(save);
    expect(restored.nextStage()).toBeNull();
    expect(restored.preparation.stageId).toBe(stage + 1);
    expect(restored.totalHealth()).toBe(maxHp);
    expect(restored.preparation.currency).toBe(money);
    expect(restored.preparation.offers).toHaveLength(3);
    expect(restored.preparation.offers.every((offer) => !offer.claimed)).toBe(true);
    expect(restored.preparation.offers).not.toEqual(before.offers);
    const settled = clone(restored.preparation);
    expect(restored.nextStage()).toBeTruthy();
    expect(restored.preparation).toEqual(settled);
  },
);

test('当前经济检查点中途返回不结算，重试可复现第20关胜利与下一关恢复', () => {
  if (!validSave(checkpoint)) throw new Error('Invalid calibration checkpoint');
  const session = Session.restore(checkpoint);
  const before = clone(session.preparation);
  expect(session.start()).toBeNull();
  for (let i = 0; i < 200; i++) session.tick();
  session.backToPreparation();
  expect(session.preparation).toEqual(before);
  expect(session.start()).toBeNull();
  for (let i = 0; i < 4000 && session.phase === 'combat'; i++) {
    expect(session.hasChoices).toBe(false);
    session.tick();
  }
  expect(session.phase).toBe('victory');
  expect(session.battle!.time).toBe(72700);
  expect(session.totalHealth()).toBe(3427);
  expect(session.battle!.report!.boostedMs).toBe(0);
  expect(validSave(session.exportSave())).toBe(true);
  expect(session.nextStage()).toBeNull();
  expect(session.preparation.stageId).toBe(21);
  expect(session.totalHealth()).toBe(18907);
  expect(session.preparation.currency).toBe(167);
});
