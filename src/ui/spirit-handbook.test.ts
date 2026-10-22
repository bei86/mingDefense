import { describe, expect, it } from 'vitest';
import { clone, config, heroIds, heroes, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { attackDamage, heroRange, releaseAttack } from '../game/combat-skills';
import type { Packet } from '../game/combat-model';
import { Session } from '../game/session';
import { spiritHandbookEntry } from './spirit-handbook';

function attack(kind: HeroId, rank: number, ordinal = 1) {
  const battle = createCombat([{ id: 1, kind, rank, position: { x: 1, y: 3 } }]);
  battle.enemies = [
    {
      id: 1,
      kind: 'wolf',
      x: 2.5,
      y: 2.5,
      hp: 10000,
      maxHp: 10000,
      cooldown: 0,
      target: null,
      recheckAt: 0,
    },
  ];
  const packets: Packet[] = [];
  releaseAttack(battle, { team: 'ally', source: 1, target: 1, ordinal, due: 0 }, packets);
  return { battle, packets };
}

describe('灵兽图鉴与实际模拟的规则一致性', () => {
  it('八灵六阶基础值与无加成战斗一致；占格始终与实际布阵形状一致', () => {
    for (const kind of heroIds) {
      for (let rank = 1; rank <= 6; rank++) {
        const entry = spiritHandbookEntry(kind, rank);
        const battle = createCombat([{ id: 1, kind, rank, position: { x: 1, y: 3 } }]);
        const ally = battle.allies[0];
        expect(entry.hp).toBe(ally.maxHp);
        expect(entry.damage).toBe(attackDamage(battle, ally));
        expect(entry.range).toBe(heroRange(ally, battle.progression));
        expect(entry.shape).toEqual(heroes[kind].shape);
        expect(entry.stats).toHaveLength(6);
        expect(entry.skills.length).toBeGreaterThan(0);
      }
    }
  });

  it('桃以真实产钱周期展示，攻速天赋与聚灵不会缩短首次产出时间', () => {
    for (let rank = 1; rank <= 6; rank++) {
      const entry = spiritHandbookEntry('fortune_peach', rank);
      const battle = createCombat([
        { id: 1, kind: 'fortune_peach', rank, position: { x: 1, y: 3 } },
      ]);
      battle.spawns = [{ at: 100000, x: 1 }];
      battle.progression.buffs.attack_speed = 3;
      battle.energy = 100;
      while (battle.time < entry.intervalMs) stepCombat(battle, true);
      expect(battle.income).toBe(0);
      const payoutAt = battle.time;
      stepCombat(battle, true);
      expect(battle.income).toBe(1);
      expect(entry.stats).toContainEqual({ label: '每次产钱', value: '1 灵钱' });
      expect(entry.stats).toContainEqual({ label: '产钱间隔', value: `${payoutAt / 1000} 秒` });
    }
  });

  it('狐的基础护盾与实际施盾一致，开场灵气只在五阶起提供', () => {
    const { battle } = attack('shield_fox', 1);
    expect(battle.allies[0].shield).toBe(Math.floor(battle.allies[0].maxHp * 0.03));
    expect(spiritHandbookEntry('shield_fox', 1).stats).toContainEqual({
      label: '每次施盾',
      value: '目标生命上限 3%',
    });
    for (const rank of [4, 5]) {
      const entry = spiritHandbookEntry('shield_fox', rank);
      const actual = createCombat([{ id: 1, kind: 'shield_fox', rank, position: { x: 1, y: 3 } }]);
      expect(entry.skills.find((skill) => skill.name === '聚灵启阵')!.unlocked).toBe(rank === 5);
      expect(actual.energy - config.energy.initial).toBe(rank === 5 ? 15 : 0);
    }
  });

  it('鱼冻结、隼留阵与猿易伤的三阶解锁符合实际攻击', () => {
    for (const rank of [2, 3]) {
      const fish = attack('ice_fish', rank, 3);
      expect(fish.packets[0].freeze).toBe(rank === 3);
      expect(
        spiritHandbookEntry('ice_fish', rank).skills.find((s) => s.name === '冰封')!.unlocked,
      ).toBe(rank === 3);
      expect(attack('sword_eagle', rank).battle.fields).toHaveLength(rank === 3 ? 1 : 0);
      expect(
        spiritHandbookEntry('sword_eagle', rank).skills.find((s) => s.name === '留阵')!.unlocked,
      ).toBe(rank === 3);
      expect(Boolean(attack('piercing_monkey', rank).packets[0].vulnerability)).toBe(rank === 3);
      expect(
        spiritHandbookEntry('piercing_monkey', rank).skills.find((s) => s.name === '破甲易伤')!
          .unlocked,
      ).toBe(rank === 3);
    }
  });

  it('隼和猿五阶才追加一段；豚五阶重击频率文案跟随实际变化', () => {
    for (const rank of [4, 5]) {
      for (const kind of ['sword_eagle', 'piercing_monkey'] as const) {
        expect(attack(kind, rank).battle.released).toHaveLength(rank === 5 ? 1 : 0);
        expect(spiritHandbookEntry(kind, rank).skills.find((s) => s.fromRank === 5)!.unlocked).toBe(
          rank === 5,
        );
      }
      expect(attack('boar', rank, 2).packets).toHaveLength(rank === 5 ? 2 : 1);
      expect(
        spiritHandbookEntry('boar', rank).skills.find((s) => s.name === '裂地重击')!.description,
      ).toContain(rank === 5 ? '每2次' : '每3次');
    }
  });

  it('鼠升到六阶也不自动获得天赋能力，低血目标仍只受基础伤害', () => {
    const entry = spiritHandbookEntry('ember_mouse', 6);
    expect(entry.skills.find((s) => s.name === '天赋扩展')!.requiresTalent).toBe(true);
    const { battle } = attack('ember_mouse', 6);
    battle.enemies[0].hp = 1;
    const packets: Packet[] = [];
    releaseAttack(battle, { team: 'ally', source: 1, target: 1, ordinal: 3, due: 0 }, packets);
    expect(packets).toHaveLength(1);
    expect(packets[0].damage).toBe(entry.damage);
    expect(packets[0].execute).toBe(false);
  });

  it('浏览与返回值修改不改变配置、存档、随机数或本轮加成', () => {
    const session = new Session();
    session.preparation.progression.buffs.health = 2;
    session.preparation.progression.buffs.attack = 2;
    const battle = createCombat(
      [{ id: 1, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } }],
      { progression: session.preparation.progression },
    );
    const base = spiritHandbookEntry('ember_mouse', 1);
    expect(battle.allies[0].maxHp).toBeGreaterThan(base.hp);
    expect(attackDamage(battle, battle.allies[0])).toBeGreaterThan(base.damage);
    const before = clone(session.exportSave());
    const definitions = clone(heroes);
    for (const kind of heroIds) {
      const entry = spiritHandbookEntry(kind, 6);
      entry.shape[0][0] = 99;
      entry.skills[0].description = '修改展示副本';
      entry.stats[0].value = '0';
    }
    expect(session.exportSave()).toEqual(before);
    expect(heroes).toEqual(definitions);
    expect(spiritHandbookEntry('ember_mouse', 1).hp).toBe(120);
  });

  it('拒绝非法阶数，避免展示缺失或错误数据', () => {
    for (const rank of [0, 7, 1.5, NaN, Infinity])
      expect(() => spiritHandbookEntry('ember_mouse', rank)).toThrow(RangeError);
  });
});
