import { expect, test } from 'vitest';
import { clone, config } from './content';
import v15 from '../../docs/superpowers/specs/2026-10-21-prototype-balance-v15-snapshot.json';
import checkpoint from './fixtures/calibration-20-checkpoint.json';
import { Session } from './session';
import { validSave } from './persistence';

test('v18只校准远程伤害及15/20首领生命，保留全部规则、八灵和关卡系数 P', () => {
  const expected = clone(v15);
  expected.contentVersion = 'prototype-2026-10-21-v18';
  expected.status = 'prototype-forty-stages-v18';
  expected.waves.spawnRow = -3;
  expected.enemies.find((e) => e.id === 'ranged')!.hitDamage = 12;
  expected.thirdBoss.hp = 357500;
  expected.fourthBoss.hp = 522500;
  expect(config).toEqual(expected);
});

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
