import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { validSave } from '../game/persistence';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import finalCheckpoint from '../game/fixtures/stage-50-checkpoint.json';
import { runPreparedBattle } from '../game/testing/campaign-battle';
import { campaignChapter, campaignProgress } from './campaign-progress';

test('十关分段在首尾及整十边界定位实际当前关', () => {
  expect([1, 10, 11, 40, 41, 50].map(campaignChapter)).toEqual([1, 1, 2, 4, 5, 5]);
});

test('新局列出50关和10位首领，只有第1关当前，不推算通关', () => {
  const progress = campaignProgress(new Session());
  expect(progress.total).toBe(50);
  expect(progress.cleared).toBe(0);
  expect(progress.bossesTotal).toBe(10);
  expect(progress.bossesCleared).toBe(0);
  expect(progress.chapters.map((chapter) => chapter.length)).toEqual([10, 10, 10, 10, 10]);
  expect(progress.entries.filter((entry) => entry.current).map((entry) => entry.id)).toEqual([1]);
  expect(progress.entries[0]).toMatchObject({ status: '当前关', cleared: false });
  expect(progress.entries[1].status).toBe('未到达');
  expect(progress.currentState).toBe('整备布阵');
});

test('稀疏记录只统计真实有效关卡，去重并标明过去未记录', () => {
  const session = new Session();
  session.preparation.stageId = 12;
  session.preparation.rewardedStages = [1, 5, 5, 10, 0, 999];
  const progress = campaignProgress(session);
  expect(progress.cleared).toBe(3);
  expect(progress.bossesCleared).toBe(2);
  expect(progress.entries[4]).toMatchObject({ boss: true, status: '已守住' });
  expect(progress.entries[10].status).toBe('未记录');
  expect(progress.entries[11].current).toBe(true);
  expect(progress.entries[12].status).toBe('未到达');
});

test.each(['baseline', 'candidate'] as const)(
  '真实%s胜败与回整备不重复计算通关或修改Session',
  (variant) => {
    const { session } = createRangedPlaytest({ caseId: 'relief', variant });
    runPreparedBattle(session, 'assault', false);
    const save = JSON.stringify(session.exportSave());
    const revision = session.revision;
    const progress = campaignProgress(session);
    expect(progress.cleared).toBe(variant === 'candidate' ? 8 : 7);
    expect(progress.current.cleared).toBe(variant === 'candidate');
    expect(progress.current.current).toBe(true);
    expect(progress.currentState).toBe(variant === 'candidate' ? '本关已守住' : '本关未守住');
    expect(JSON.stringify(session.exportSave())).toBe(save);
    expect(session.revision).toBe(revision);
    if (variant === 'candidate') {
      const campaign = Session.restore(session.exportSave());
      campaign.backToPreparation();
      expect(campaignProgress(campaign).cleared).toBe(8);
    }
    // The single-stage trial intentionally restores its original opening on return.
    session.backToPreparation();
    expect(campaignProgress(session).cleared).toBe(7);
    expect(campaignProgress(session).currentState).toBe('整备布阵');
    expect(session.start()).toBeNull();
    session.pause(true);
    expect(campaignProgress(session).cleared).toBe(7);
    expect(campaignProgress(session).currentState).toBe('守卫已暂停');
  },
);

test('真实守卫、暂停、待选和中止保持原通关记录', () => {
  const session = new Session();
  expect(session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  expect(
    session.transfer({ type: 'offer', id: 2 }, { merge: session.preparation.units[0].id }),
  ).toBeNull();
  expect(session.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 })).toBeNull();
  expect(session.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 })).toBeNull();
  expect(session.start()).toBeNull();
  expect(campaignProgress(session).currentState).toBe('正在守卫');
  for (let i = 0; i < 3600 && !session.hasChoices && session.phase === 'combat'; i++)
    session.tick();
  expect(session.hasChoices).toBe(true);
  expect(campaignProgress(session).currentState).toBe('待选天赋');
  expect(campaignProgress(session).cleared).toBe(0);
  session.backToPreparation();
  expect(campaignProgress(session).cleared).toBe(0);
});

test('合法终战真实胜利后50关及10位首领全部计入，当前仍标第50关', () => {
  if (!validSave(finalCheckpoint)) throw new Error('终战检查点无效');
  const session = Session.restore(finalCheckpoint);
  runPreparedBattle(session, 'control', false);
  expect(session.complete).toBe(true);
  const before = JSON.stringify(session.exportSave());
  const progress = campaignProgress(session);
  expect(progress.cleared).toBe(50);
  expect(progress.bossesCleared).toBe(10);
  expect(progress.current).toMatchObject({ id: 50, current: true, cleared: true, boss: true });
  expect(progress.currentState).toBe('五十关已完成');
  expect(JSON.stringify(session.exportSave())).toBe(before);
});
