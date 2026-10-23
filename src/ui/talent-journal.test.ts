import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import type { BuffId, Unit } from '../game/model';
import { Session } from '../game/session';
import { talentJournal } from './talent-journal';

describe('已选天赋只读手札', () => {
  it.each<[BuffId, number, string]>([
    ['attack', 10, '+100%'],
    ['attack_speed', 2, '+20%'],
    ['health', 2, '+30%'],
    ['range', 3, '+0.6 格'],
    ['slow', 2, '-10%'],
    ['reward', 2, '+10 灵钱'],
    ['eagle_residue', 2, '+30%'],
    ['boar_attack', 2, '+24%'],
    ['bear_attack', 2, '+20%'],
    ['monkey_vulnerability', 2, '+10 个百分点'],
    ['fox_shield', 2, '+16%'],
    ['mouse_finisher', 1, '+50%'],
    ['mouse_execute', 1, '10% 概率'],
  ])('%s无候选且满层也保留正确累计单位', (id, level, contribution) => {
    const s = new Session();
    s.preparation.progression.buffs[id] = level;
    expect(talentJournal(s)).toEqual([
      expect.objectContaining({ id, level, contribution, maxLevel: expect.any(Number) }),
    ]);
    expect(talentJournal(s)[0].maxLevel).toBeGreaterThanOrEqual(level);
  });

  it('空手札与显式0层不显示，按配置稳定顺序而非存档插入顺序', () => {
    const s = new Session();
    expect(talentJournal(s)).toEqual([]);
    s.preparation.progression.buffs = { mouse_execute: 1, health: 0, range: 1, attack: 10 };
    expect(talentJournal(s).map((entry) => entry.id)).toEqual(['attack', 'range', 'mouse_execute']);
    expect(talentJournal(s)[0]).toMatchObject({ level: 10, maxLevel: 10 });
  });

  it('整备通用范围区别已上阵与备战，桃狐按实际技能排除，未领取不计', () => {
    const s = new Session();
    s.preparation.units = [
      { id: 1, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 2, kind: 'shield_fox', rank: 1, position: { x: 2, y: 3 } },
      { id: 3, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 3 } },
      { id: 4, kind: 'boar', rank: 1, position: null },
      { id: 5, kind: 'shield_fox', rank: 1, position: null },
    ];
    s.preparation.progression.buffs = { attack: 1, attack_speed: 1, health: 1, range: 1 };
    const entries = talentJournal(s);
    expect(entries.find((e) => e.id === 'attack')!.scope).toBe(
      '输出灵兽 · 已上阵 1只 · 备战 1只（需上阵）',
    );
    expect(entries.find((e) => e.id === 'attack_speed')!.scope).toBe(
      '攻击/施盾灵兽 · 已上阵 2只 · 备战 2只（需上阵）',
    );
    expect(entries.find((e) => e.id === 'range')!.scope).toBe(
      '攻击/施盾灵兽 · 已上阵 2只 · 备战 2只（需上阵）',
    );
    expect(entries.find((e) => e.id === 'health')!.scope).toBe(
      '灵兽 · 已上阵 3只 · 备战 2只（需上阵）',
    );
  });

  it.each<BuffId>(['eagle_residue', 'monkey_vulnerability'])(
    '%s整备专属按最低阶计数，备战不当成已上阵',
    (id) => {
      const s = new Session();
      const kind = id === 'eagle_residue' ? 'sword_eagle' : 'piercing_monkey';
      s.preparation.units = [
        { id: 1, kind, rank: 1, position: { x: 1, y: 3 } },
        { id: 2, kind, rank: 3, position: { x: 2, y: 3 } },
        { id: 3, kind, rank: 6, position: null },
        { id: 4, kind: 'boar', rank: 6, position: { x: 3, y: 3 } },
      ];
      s.preparation.progression.buffs[id] = 1;
      expect(talentJournal(s)[0].scope).toContain('3阶起 · 已上阵 1只 · 备战 1只（需上阵）');
      s.preparation.units[1].position = null;
      expect(talentJournal(s)[0].scope).toContain('已上阵 0只 · 备战 2只（需上阵）');
    },
  );

  it('战斗优先读取本关成长与当前存活，倒下和未上阵不误计', () => {
    const s = new Session();
    const units: Unit[] = [
      { id: 1, kind: 'scatter_bear', rank: 3, position: { x: 1, y: 3 } },
      { id: 2, kind: 'scatter_bear', rank: 3, position: { x: 2, y: 3 } },
      { id: 3, kind: 'scatter_bear', rank: 6, position: null },
    ];
    s.preparation.progression.buffs = { attack: 1 };
    s.battle = createCombat(units, { stageId: 6 });
    s.phase = 'combat';
    s.battle.progression.buffs = { bear_attack: 2, attack: 2 };
    s.battle.allies[0].hp = 0;
    const before = JSON.stringify(s);
    const entries = talentJournal(s);
    expect(entries.find((e) => e.id === 'attack')).toMatchObject({
      contribution: '+20%',
      scope: '存活输出灵兽 1只',
    });
    expect(entries.find((e) => e.id === 'bear_attack')!.scope).toContain(
      '存活施放者 1只（另有1只倒下）',
    );
    expect(JSON.stringify(s)).toBe(before);
    s.battle.allies[1].hp = 0;
    expect(talentJournal(s).find((e) => e.id === 'bear_attack')!.scope).toContain(
      '当前无存活施放者',
    );
    s.phase = 'victory';
    expect(talentJournal(s).find((e) => e.id === 'attack')!.level).toBe(2);
  });

  it('整备读取完全只读；无施放者仍保留已获得专属及条件，不承诺返还生息补量', () => {
    const s = new Session();
    s.preparation.progression.buffs = {
      health: 1,
      fox_shield: 1,
      slow: 1,
      reward: 1,
      mouse_execute: 1,
    };
    const before = JSON.stringify(s);
    const entries = talentJournal(s);
    expect(entries.find((e) => e.id === 'fox_shield')!.scope).toContain('已上阵 0只');
    expect(entries.find((e) => e.id === 'health')!.note).toContain('倒下不复活');
    expect(entries.find((e) => e.id === 'slow')!.scope).toBe('全场敌方移速');
    expect(entries.find((e) => e.id === 'reward')!.note).toContain('不是立即领取');
    expect(entries.find((e) => e.id === 'mouse_execute')!.note).toContain('低于30%的非首领');
    expect(JSON.stringify(s)).toBe(before);
  });
});
