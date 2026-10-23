import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { createCombat, chooseCombatBuff } from '../game/combat';
import { maxHeroHp } from '../game/combat-skills';
import type { BuffId, Unit } from '../game/model';
import { Session } from '../game/session';
import { talentPreview } from './talent-preview';

function battle(id: BuffId, units: Unit[] = []) {
  const b = createCombat(units, { stageId: 6 });
  b.choices = [id];
  b.pendingChoices = 1;
  return b;
}

describe('天赋选择前只读收益预览', () => {
  it('真实Session合法三选一读取不消费随机、不刷新候选、不推进时钟，原选择仍可继续', () => {
    const s = new Session();
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
    const mouse = s.preparation.units[0].id;
    expect(s.transfer({ type: 'offer', id: 2 }, { merge: mouse })).toBeNull();
    expect(s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 })).toBeNull();
    expect(s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 })).toBeNull();
    expect(s.start()).toBeNull();
    for (let i = 0; i < 3000 && s.canAdvance; i++) s.tick();
    expect(s.hasChoices).toBe(true);
    const before = JSON.stringify(s);
    for (const id of s.battle!.choices) expect(talentPreview(s.battle, id)).not.toBeNull();
    s.tick();
    expect(JSON.stringify(s)).toBe(before);
    const id = s.battle!.choices[0];
    const next = talentPreview(s.battle, id)!.nextLevel;
    expect(s.chooseBuff(id)).toBeNull();
    expect(s.battle!.progression.buffs[id]).toBe(next);
    expect(s.hasChoices).toBe(false);
    expect(s.canAdvance).toBe(true);
  });

  it.each<[BuffId, number, string, string]>([
    ['attack', 2, '+20%', '+30%'],
    ['attack_speed', 9, '+90%', '+100%'],
    ['health', 0, '+0%', '+15%'],
    ['range', 2, '+0.4 格', '+0.6 格'],
    ['slow', 1, '-5%', '-10%'],
    ['reward', 1, '+5 灵钱', '+10 灵钱'],
    ['eagle_residue', 0, '+0%', '+15%'],
    ['boar_attack', 2, '+24%', '+36%'],
    ['bear_attack', 1, '+10%', '+20%'],
    ['monkey_vulnerability', 2, '+10 个百分点', '+15 个百分点'],
    ['fox_shield', 2, '+16%', '+24%'],
    ['mouse_finisher', 0, '+0%', '+50%'],
    ['mouse_execute', 0, '0% 概率', '10% 概率'],
  ])('%s按本天赋累计展示前后值和正确单位', (id, level, before, after) => {
    const b = battle(id);
    b.progression.buffs[id] = level;
    expect(talentPreview(b, id)).toMatchObject({
      currentLevel: level,
      nextLevel: level + 1,
      before,
      after,
    });
  });

  it('无战斗、非候选或已到上限不生成超限预览', () => {
    expect(talentPreview(null, 'attack')).toBeNull();
    const b = battle('attack');
    expect(talentPreview(b, 'health')).toBeNull();
    b.progression.buffs.attack = 9;
    expect(talentPreview(b, 'attack')).toMatchObject({
      currentLevel: 9,
      nextLevel: 10,
      maxLevel: 10,
    });
    b.progression.buffs.attack = 10;
    expect(talentPreview(b, 'attack')).toBeNull();
  });

  it('生息补量与真实选择后总生命差一致，受伤者补增量，倒下者不复活', () => {
    const b = battle('health', [
      { id: 1, kind: 'ember_mouse', rank: 2, position: { x: 1, y: 3 } },
      { id: 2, kind: 'shield_fox', rank: 1, position: { x: 2, y: 4 } },
      { id: 3, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 4 } },
    ]);
    b.allies[0].hp = 71.5;
    b.allies[1].hp = 0;
    const before = clone(b);
    const view = talentPreview(b, 'health')!;
    expect(b).toEqual(before);
    expect(view.healthGain).toBe(66);
    expect(view.scope).toContain('存活灵兽 2只');
    expect(view.note).toContain('倒下不复活');
    expect(chooseCombatBuff(b, 'health')).toBeNull();
    const oldHp = before.allies.reduce((sum, u) => sum + u.hp, 0);
    const newHp = b.allies.reduce((sum, u) => sum + u.hp, 0);
    expect(newHp - oldHp).toBe(view.healthGain);
    expect(b.allies[1].hp).toBe(0);
    expect(b.allies[0].hp).toBeLessThan(b.allies[0].maxHp);
    for (const ally of b.allies) expect(ally.maxHp).toBe(maxHeroHp(ally, b.progression));
  });

  it('生息已叠层时仍按每只基础上限取整的真实增量计算，不按当前受伤生命乘百分比', () => {
    const b = battle('health', [{ id: 1, kind: 'boar', rank: 3, position: { x: 1, y: 3 } }]);
    b.progression.buffs.health = 2;
    b.allies[0].maxHp = maxHeroHp(b.allies[0], b.progression);
    b.allies[0].hp = 1;
    const predicted = talentPreview(b, 'health')!;
    const old = b.allies[0].maxHp;
    chooseCombatBuff(b, 'health');
    expect(predicted.healthGain).toBe(b.allies[0].maxHp - old);
    expect(b.allies[0].hp).toBe(1 + predicted.healthGain!);
  });

  it('通用范围排除备战，攻击排除桃狐，攻速和射程包含狐但排除桃，生命包含所有存活者', () => {
    const b = battle('attack', [
      { id: 1, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 2, kind: 'boar', rank: 1, position: { x: 2, y: 3 } },
      { id: 3, kind: 'shield_fox', rank: 1, position: { x: 2, y: 4 } },
      { id: 4, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 4 } },
      { id: 5, kind: 'ember_mouse', rank: 6, position: null },
    ]);
    b.allies[1].hp = 0;
    b.choices = ['attack', 'attack_speed', 'range', 'health'];
    expect(talentPreview(b, 'attack')!.scope).toBe('存活输出灵兽 1只');
    expect(talentPreview(b, 'attack_speed')!.scope).toBe('存活攻击/施盾灵兽 2只');
    expect(talentPreview(b, 'range')!.scope).toBe('存活攻击/施盾灵兽 2只');
    expect(talentPreview(b, 'health')!.scope).toBe('存活灵兽 3只');
  });

  it.each<BuffId>(['eagle_residue', 'monkey_vulnerability'])(
    '%s专属按配置最低阶与死亡分开，不含备战',
    (id) => {
      const kind = id === 'eagle_residue' ? 'sword_eagle' : 'piercing_monkey';
      const b = battle(id, [
        { id: 1, kind, rank: 1, position: { x: 0, y: 2 } },
        { id: 2, kind, rank: 3, position: { x: 2, y: 2 } },
        { id: 3, kind, rank: 6, position: { x: 2, y: 4 } },
        { id: 4, kind, rank: 6, position: null },
        { id: 5, kind: 'boar', rank: 6, position: { x: 4, y: 4 } },
      ]);
      b.allies[2].hp = 0;
      const view = talentPreview(b, id)!;
      expect(view.scope).toContain('3阶起');
      expect(view.scope).toContain('存活施放者 1只');
      expect(view.scope).toContain('另有1只倒下');
      b.allies[1].hp = 0;
      expect(talentPreview(b, id)!.scope).toContain('当前无存活施放者');
    },
  );

  it('狐豚熊鼠专属都只统计同种存活施放者，不把攻击型通用范围当专属范围', () => {
    const b = battle('fox_shield', [
      { id: 1, kind: 'shield_fox', rank: 1, position: { x: 0, y: 2 } },
      { id: 2, kind: 'boar', rank: 1, position: { x: 1, y: 2 } },
      { id: 3, kind: 'scatter_bear', rank: 1, position: { x: 3, y: 2 } },
      { id: 4, kind: 'ember_mouse', rank: 1, position: { x: 4, y: 2 } },
    ]);
    b.choices = ['fox_shield', 'boar_attack', 'bear_attack', 'mouse_finisher', 'mouse_execute'];
    for (const id of b.choices) expect(talentPreview(b, id)!.scope).toContain('存活施放者 1只');
  });

  it('零存活时生息补量为0，迟滞与丰收仍展示规则范围，丰收不承诺马上发钱', () => {
    const b = battle('health');
    b.choices = ['health', 'slow', 'reward'];
    expect(talentPreview(b, 'health')).toMatchObject({ healthGain: 0, scope: '存活灵兽 0只' });
    expect(talentPreview(b, 'slow')!.scope).toBe('全场敌方移速');
    expect(talentPreview(b, 'slow')!.before).toBe('0%');
    expect(talentPreview(b, 'reward')!.scope).toBe('首次通关结算');
    expect(talentPreview(b, 'reward')!.note).toContain('不是立即领取');
  });

  it('累计与条件分开：攻速/减速上限、残血严格低于、斩杀非首领、已有剑阵不回算', () => {
    const b = battle('attack_speed');
    b.choices = ['attack_speed', 'slow', 'mouse_finisher', 'mouse_execute', 'eagle_residue'];
    expect(talentPreview(b, 'attack_speed')!.note).toContain('最多 +200%');
    expect(talentPreview(b, 'slow')!.note).toContain('最多降低60%');
    expect(talentPreview(b, 'mouse_finisher')!.note).toContain('低于30%');
    expect(talentPreview(b, 'mouse_execute')!.note).toContain('非首领');
    expect(talentPreview(b, 'mouse_execute')!.note).toContain('低于30%');
    expect(talentPreview(b, 'eagle_residue')!.note).toContain('已有剑阵不回算');
  });
});
