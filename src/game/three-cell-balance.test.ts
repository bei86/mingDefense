import { expect, test } from 'vitest';
import { clone, config } from './content';
import v15 from '../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';
import checkpoint from './fixtures/calibration-20-checkpoint.json';
import checkpoint25 from './fixtures/calibration-25-checkpoint.json';
import checkpoint30 from './fixtures/calibration-30-checkpoint.json';
import checkpoint35 from './fixtures/calibration-35-checkpoint.json';
import checkpoint40 from './fixtures/calibration-40-checkpoint.json';
import { Session } from './session';
import { validSave } from './persistence';

test('v22三格校准只修改授权数值，保留其余完整配置 P', () => {
  const expected = clone(v15);
  expected.contentVersion = 'prototype-2026-10-21-v22';
  expected.status = 'prototype-forty-stages-v22';
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
  expected.stages[32].hpMultiplier = 39.6;
  expected.seventhBoss.hp = 1480000;
  expected.stages[34].waves.forEach((wave) => {
    Object.assign(wave.enemies, { ranged: 1 });
  });
  expected.stages[34].waves[1].atMs = 5000;
  expected.stages[36].attackMultiplier = 7.3;
  expected.stages[38].hpMultiplier = 20.5;
  expected.eighthBoss.hp = 1020000;
  expected.stages[39].waves.forEach((wave) => {
    Object.assign(wave.enemies, { ranged: 1 });
  });
  expected.stages[39].waves[1].atMs = 5000;
  expect(config).toEqual(expected);
});

test.each([
  {
    checkpoint: checkpoint35,
    stage: 35,
    time: 106950,
    hp: 8334,
    maxHp: 17332,
    money: 296,
    choiceCount: 0,
  },
  {
    checkpoint: checkpoint25,
    stage: 25,
    time: 78000,
    hp: 8089,
    maxHp: 16456,
    money: 217,
    choiceCount: 1,
  },
  {
    checkpoint: checkpoint30,
    stage: 30,
    time: 101000,
    hp: 5599,
    maxHp: 17251,
    money: 266,
    choiceCount: 1,
  },
])(
  '第$stage关当前经济检查点可中止重试、处理天赋队列、结算及继续下关且不重复奖励',
  ({ checkpoint, stage, time, hp, maxHp, money, choiceCount }) => {
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
    expect(choices).toBe(choiceCount);
    expect(session.phase).toBe('victory');
    expect(session.battle!.time).toBe(time);
    expect(session.totalHealth()).toBe(hp);
    expect(session.battle!.report!.boostedMs).toBe(0);
    if (stage === 35) {
      expect(session.battle!.damageDone).toBe(1614400);
      expect(session.battle!.damageTaken).toBe(8998);
      expect(session.battle!.kills).toBe(29);
      expect(session.lastReward + session.lastIncome + session.lastBonus).toBe(288);
    }
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

test('第40关合法不聚灵路线可中止重试、保存完成态且不会生成41关或重复结算', () => {
  if (!validSave(checkpoint40)) throw new Error('Invalid stage-40 checkpoint');
  const session = Session.restore(checkpoint40);
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
  expect(session.complete).toBe(true);
  expect(session.battle!.time).toBe(98050);
  expect(session.totalHealth()).toBe(4919);
  expect(session.battle!.report!.boostedMs).toBe(0);
  expect(session.battle!.damageDone).toBe(1180480);
  expect(session.battle!.damageTaken).toBe(12413);
  expect(session.battle!.kills).toBe(31);
  expect(session.lastReward + session.lastIncome + session.lastBonus).toBe(313);
  expect(session.preparation.currency).toBe(326);
  expect(session.preparation.rewardedStages).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  expect(session.preparation.offers).toEqual(before.offers);
  expect(session.preparation.rng).toBe(before.rng);
  const save = session.exportSave();
  expect(validSave(save)).toBe(true);
  const restored = Session.restore(save);
  expect(restored.complete).toBe(true);
  expect(restored.totalHealth()).toBe(4919);
  expect(restored.nextStage()).toBe('本轮已经完成');
  for (let i = 0; i < 20; i++) restored.tick();
  expect(restored.exportSave()).toEqual(save);
  expect(restored.preparation.stageId).toBe(40);
});
