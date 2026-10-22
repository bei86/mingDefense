import { describe, expect, it } from 'vitest';
import { clone, heroes } from '../game/content';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { stepCombat } from '../game/combat';
import { updateSummoner } from '../game/enemy-abilities';
import { attackEffect, FieldEffects } from './field-effects';

function prepared() {
  const session = new Session();
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  return session;
}

describe('只读画面事件，不改变游戏规则', () => {
  it('真实合成触发一次，重复绘制不重播；撤销清除，重新合成可再触发', () => {
    const session = prepared();
    const effects = new FieldEffects();
    expect(effects.update(session, 16)).toEqual([]);
    const id = session.preparation.units[0].id;
    session.transfer({ type: 'offer', id: 2 }, { merge: id });
    expect(effects.update(session, 16).map((event) => event.effect.key)).toEqual(['fx_merge']);
    expect(effects.update(session, 16)).toHaveLength(1);
    session.undo();
    expect(effects.update(session, 16)).toEqual([]);
    session.transfer({ type: 'offer', id: 2 }, { merge: id });
    expect(effects.update(session, 16)).toHaveLength(1);
    for (let i = 0; i < 7; i++) effects.update(session, 100);
    expect(effects.update(session, 16)).toEqual([]);
  });

  it('初次打开、普通移动、备战席合成与重开不会在棋盘伪造合成', () => {
    const session = prepared();
    const effects = new FieldEffects();
    effects.update(session, 16);
    session.transfer({ type: 'unit', id: session.preparation.units[0].id }, { x: 1, y: 4 });
    expect(effects.update(session, 16)).toEqual([]);
    session.transfer({ type: 'unit', id: session.preparation.units[0].id }, 'reserve');
    effects.update(session, 16);
    session.transfer({ type: 'offer', id: 2 }, { merge: session.preparation.units[0].id });
    expect(effects.update(session, 16)).toEqual([]);
    session.reset();
    expect(effects.update(session, 16)).toEqual([]);
  });

  it('准备阶段重开立即清除尚未结束的合成光效', () => {
    const session = prepared();
    const effects = new FieldEffects();
    effects.update(session, 16);
    session.transfer({ type: 'offer', id: 2 }, { merge: session.preparation.units[0].id });
    expect(effects.update(session, 16)).toHaveLength(1);
    session.reset();
    expect(effects.update(session, 16)).toEqual([]);
  });

  it('真实产钱触发一次，暂停冻结，读档或重试不重播旧收入', () => {
    const session = prepared();
    session.preparation.units[0].kind = 'fortune_peach';
    session.start();
    const battle = session.battle!;
    battle.spawns = [{ at: 100000, x: 1 }];
    const effects = new FieldEffects();
    effects.update(session, 16);
    battle.time = heroes.fortune_peach.incomeIntervalMs![0];
    stepCombat(battle);
    expect(effects.update(session, 16).map((event) => event.effect.key)).toEqual(['fx_income']);
    session.pause(true);
    const paused = effects.update(session, 16);
    expect(effects.update(session, 5000)).toEqual(paused);
    expect(new FieldEffects().update(session, 16)).toEqual([]);
    session.backToPreparation();
    expect(effects.update(session, 16)).toEqual([]);
    session.start();
    expect(effects.update(session, 16)).toEqual([]);
  });

  it('真实召唤只在新召唤物处触发；普通出怪和分裂不误播召唤环', () => {
    const session = prepared();
    session.start();
    const battle = session.battle!;
    const effects = new FieldEffects();
    effects.update(session, 16);
    const summoner = spawnEnemy(battle, 'summoner', { x: 2, y: 0 });
    spawnEnemy(battle, 'split_fragment', { x: 3, y: 0 }, summoner.id);
    expect(effects.update(session, 16)).toEqual([]);
    battle.time = summoner.nextSummon!;
    updateSummoner(battle, summoner);
    const births = effects.update(session, 16);
    expect(births).toHaveLength(2);
    expect(births.every((event) => event.effect.key === 'fx_summon')).toBe(true);
    expect(effects.update(session, 16)).toHaveLength(2);
  });

  it('实际击杀升级只为存活上阵灵兽播放，择天赋暂停时不消逝，也不修改Session', () => {
    const session = prepared();
    session.preparation.progression.xp = 59;
    session.start();
    const battle = session.battle!;
    const effects = new FieldEffects();
    effects.update(session, 16);
    const enemy = spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
    enemy.hp = 0;
    stepCombat(battle);
    expect(session.hasChoices).toBe(true);
    const before = clone(session);
    const events = effects.update(session, 16);
    expect(events.map((event) => event.effect.key)).toEqual(['fx_levelup']);
    expect(effects.update(session, 1000)).toEqual(events);
    expect(session).toEqual(before);
    session.backToPreparation();
    expect(effects.update(session, 16)).toEqual([]);
  });

  it('大量同帧事件有数量上限，过期后回收', () => {
    const session = prepared();
    session.start();
    const effects = new FieldEffects();
    effects.update(session, 16);
    for (let i = 0; i < 80; i++) spawnEnemy(session.battle!, 'summoned_wolf', { x: 1, y: 0 }, 100);
    expect(effects.update(session, 16)).toHaveLength(48);
    for (let i = 0; i < 8; i++) effects.update(session, 100);
    expect(effects.update(session, 16)).toEqual([]);
  });
});

describe('攻击图片沿已有命中flash定向，不增加模拟伤害', () => {
  const flash = {
    team: 'ally' as const,
    kind: 'ember_mouse' as const,
    from: { x: 1, y: 3 },
    to: { x: 1, y: 0 },
    at: 100,
  };
  it('向上火球保持正向，右侧火球顺时针旋转；生命周期有界', () => {
    expect(attackEffect(flash, 250)).toMatchObject({
      key: 'fx_fireball',
      point: { x: 1, y: 1.5 },
      rotation: 0,
    });
    expect(attackEffect({ ...flash, to: { x: 3, y: 3 } }, 250)?.rotation).toBe(Math.PI / 2);
    expect(attackEffect(flash, 99)).toBeNull();
    expect(attackEffect(flash, 400)).toBeNull();
    expect(attackEffect({ ...flash, team: 'enemy' }, 150)).toBeNull();
    expect(attackEffect({ ...flash, to: flash.from }, 150)).toBeNull();
  });
  it('贯穿使用路径中点与长度，拳罡沿各自射线运动；原始flash不变', () => {
    const before = clone(flash);
    expect(attackEffect({ ...flash, kind: 'piercing_monkey' }, 250)).toMatchObject({
      key: 'fx_pierce',
      point: { x: 1, y: 1.5 },
      width: 3,
      rotation: -Math.PI / 2,
    });
    expect(attackEffect({ ...flash, kind: 'scatter_bear' }, 250)?.key).toBe('fx_fist');
    expect(attackEffect({ ...flash, kind: 'shield_fox' }, 250)).toBeNull();
    expect(flash).toEqual(before);
  });
});
