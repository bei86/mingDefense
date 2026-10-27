import { expect, test } from 'vitest';
import { buffDefinitions, eligibleBuffs } from '../game/progression';
import type { BuffId } from '../game/model';
import { Session } from '../game/session';
import { validSave } from '../game/persistence';
import finalCheckpoint from '../game/fixtures/stage-50-checkpoint.json';
import { talentCatalogue } from './talent-catalogue';

test('空阵容仍列全部配置，只有通用满足入池；查看不消耗随机或改写会话', () => {
  const session = new Session();
  const before = JSON.stringify(session);
  const entries = talentCatalogue(session);
  expect(entries.map((entry) => entry.id)).toEqual(Object.keys(buffDefinitions));
  expect(entries).toHaveLength(13);
  expect(entries.filter((entry) => entry.eligible).map((entry) => entry.id)).toEqual([
    'attack',
    'attack_speed',
    'health',
    'range',
    'slow',
    'reward',
  ]);
  expect(entries.every((entry) => entry.level === 0 && !entry.maxed)).toBe(true);
  expect(entries.find((entry) => entry.id === 'attack')?.requirements).toEqual([]);
  expect(JSON.stringify(session)).toBe(before);
});

test('终烬逐项说明上阵鼠、追烬及第6关门槛，前置满层也算已获得', () => {
  const session = new Session();
  let entry = talentCatalogue(session).find((entry) => entry.id === 'mouse_execute')!;
  expect(entry.requirements).toEqual(['第6关起', '先获得「追烬」', '上阵烬灵鼠（备战不计）']);
  expect(entry.blockers).toHaveLength(3);
  session.preparation.stageId = 6;
  entry = talentCatalogue(session).find((entry) => entry.id === 'mouse_execute')!;
  expect(entry.blockers).toEqual(['先获得「追烬」', '上阵烬灵鼠（备战不计）']);
  session.preparation.progression.buffs.mouse_finisher = 1;
  session.preparation.units = [{ id: 1, kind: 'ember_mouse', rank: 1, position: null }];
  expect(talentCatalogue(session).find((entry) => entry.id === 'mouse_execute')?.blockers).toEqual([
    '上阵烬灵鼠（备战不计）',
  ]);
  session.preparation.units[0].position = { x: 2, y: 3 };
  entry = talentCatalogue(session).find((entry) => entry.id === 'mouse_execute')!;
  expect(entry.eligible).toBe(true);
  expect(entry.blockers).toEqual([]);
  expect(entry.note).toContain('非首领');
});

test('隼猿必须3阶上阵，备战不计；入池与引擎逐项一致', () => {
  const session = new Session();
  session.preparation.units = [
    { id: 1, kind: 'sword_eagle', rank: 2, position: { x: 2, y: 4 } },
    { id: 2, kind: 'piercing_monkey', rank: 3, position: null },
  ];
  let entries = talentCatalogue(session);
  expect(entries.find((entry) => entry.id === 'eagle_residue')?.blockers).toEqual([
    '上阵青锋隼（3阶起，备战不计）',
  ]);
  expect(entries.find((entry) => entry.id === 'monkey_vulnerability')?.eligible).toBe(false);
  session.preparation.units[0].rank = 3;
  session.preparation.units[1].position = { x: 1, y: 3 };
  entries = talentCatalogue(session);
  expect(entries.find((entry) => entry.id === 'eagle_residue')?.eligible).toBe(true);
  expect(entries.find((entry) => entry.id === 'monkey_vulnerability')?.eligible).toBe(true);
  expect(entries.filter((entry) => entry.eligible).map((entry) => entry.id)).toEqual(
    eligibleBuffs(session.preparation.progression, session.preparation.units, 1),
  );
});

test('所有已满层仍可查看，单独标记并不再入池', () => {
  const session = new Session();
  for (const id of Object.keys(buffDefinitions) as BuffId[])
    session.preparation.progression.buffs[id] = buffDefinitions[id].maxLevel;
  const entries = talentCatalogue(session);
  expect(entries).toHaveLength(13);
  expect(entries.every((entry) => entry.maxed && !entry.eligible)).toBe(true);
  expect(entries.find((entry) => entry.id === 'range')?.level).toBe(3);
});

test('真实终战开局优先本场成长与关卡，上阵者倒下不改变入池，查看不触碰候选和暂停', () => {
  if (!validSave(finalCheckpoint)) throw Error('终战检查点无效');
  const session = Session.restore(finalCheckpoint);
  expect(session.start()).toBeNull();
  const battle = session.battle!;
  session.paused = true;
  battle.progression.buffs = { health: 2, mouse_finisher: 1 };
  battle.choices = ['range'];
  battle.pendingChoices = 1;
  for (const ally of battle.allies) ally.hp = 0;
  const before = JSON.stringify(session);
  const entries = talentCatalogue(session);
  expect(entries.find((entry) => entry.id === 'health')?.level).toBe(2);
  const expected = eligibleBuffs(battle.progression, battle.allies, battle.stageId);
  expect(entries.filter((entry) => entry.eligible).map((entry) => entry.id)).toEqual(expected);
  expect(entries.find((entry) => entry.id === 'mouse_execute')?.eligible).toBe(true);
  expect(JSON.stringify(session)).toBe(before);
});
