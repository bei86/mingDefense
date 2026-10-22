import { describe, expect, it } from 'vitest';
import { clone, config } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { Session } from '../game/session';
import { defeatRecap, preparationAdvice, type DefeatRecap } from './defeat-advice';

function mouseSession() {
  const s = new Session();
  s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  return s;
}

const fallen: DefeatRecap = { stageId: 1, cause: 'fallen', title: '', detail: '' };

describe('失守复盘与当前布阵建议', () => {
  it('真实单鼠战斗失败后提取事实；回到检查点仍有免费招募及合成机会', () => {
    const s = mouseSession();
    const checkpoint = s.exportSave().preparation;
    s.start();
    for (let i = 0; i < 4000 && s.phase === 'combat'; i++) {
      if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
      else s.tick();
    }
    expect(s.phase).toBe('defeat');
    const recap = defeatRecap(s.battle)!;
    expect(recap.cause).toBe('fallen');
    expect(recap.damageFact).toContain('烬灵鼠1阶（第2列第4行）');
    expect(recap.damageFact).toContain('不含护盾吸收');
    s.backToPreparation();
    expect(s.preparation).toEqual(checkpoint);
    expect(preparationAdvice(s.preparation, s.maxRank, recap).map((t) => t.id)).toEqual([
      'deploy',
      'merge',
      'tactics',
    ]);
  });

  it('真实模拟时限有存活者为超时；同一步全员重伤优先', () => {
    const s = createCombat(mouseSession().preparation.units);
    s.time = config.runtime.stageLimitMs - config.runtime.tickMs;
    s.spawns = [{ at: config.runtime.stageLimitMs + 1000, x: 1 }];
    stepCombat(s);
    expect(s.result).toBe('defeat');
    expect(defeatRecap(s)).toMatchObject({ cause: 'timeout', title: '守阵时间耗尽' });
    s.result = null;
    s.allies[0].hp = 0;
    stepCombat(s);
    expect(defeatRecap(s)?.cause).toBe('fallen');
  });

  it('胜利、未结束和空战斗没有失守复盘；异常旧状态不猜失败原因', () => {
    expect(defeatRecap(null)).toBeNull();
    const s = createCombat(mouseSession().preparation.units);
    expect(defeatRecap(s)).toBeNull();
    s.result = 'victory';
    expect(defeatRecap(s)).toBeNull();
    s.result = 'defeat';
    expect(defeatRecap(s)?.cause).toBe('unknown');
  });

  it('没有逐兽数据或承伤为零时不伪造单兽承伤；匹配实例而非数组顺序', () => {
    const s = createCombat(mouseSession().preparation.units);
    s.result = 'defeat';
    expect(defeatRecap(s)?.damageFact).toBeUndefined();
    const id = s.allies[0].id;
    s.report!.units.unshift({
      id: 100,
      damageTaken: 1,
      damageDone: 0,
      shieldGiven: 0,
      shieldAbsorbed: 0,
      income: 0,
    });
    s.report!.units.find((u) => u.id === id)!.damageTaken = 120;
    expect(defeatRecap(s)?.damageFact).toContain('120');
    s.report = undefined;
    expect(defeatRecap(s)?.damageFact).toBeUndefined();
  });

  it('部署、合成和刷新后使用实际阵容，不残留旧机会', () => {
    const s = mouseSession();
    const advice = () => preparationAdvice(s.preparation, s.maxRank, fallen);
    expect(advice().some((t) => t.id === 'merge')).toBe(true);
    s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id });
    expect(advice().some((t) => t.id === 'merge')).toBe(false);
    expect(advice().find((t) => t.id === 'deploy')?.text).toContain('岩甲豚');
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    expect(advice().find((t) => t.id === 'deploy')?.text).toContain('青锋隼');
    s.refresh(true);
    expect(advice().find((t) => t.id === 'deploy')?.text).not.toContain('青锋隼');
  });

  it('备战席优先提示可放下的灵兽，不能把未上阵灵兽当成输出', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, 'reserve');
    const tips = preparationAdvice(s.preparation, s.maxRank, fallen);
    expect(tips.find((t) => t.id === 'deploy')?.text).toContain('备战席中的烬灵鼠');
    expect(tips.some((t) => t.id === 'output')).toBe(true);
    s.transfer({ type: 'unit', id: s.preparation.units[0].id }, { x: 1, y: 3 });
    expect(preparationAdvice(s.preparation, s.maxRank, fallen).some((t) => t.id === 'output')).toBe(
      false,
    );
  });

  it('满阵不推荐部署，断开的空位不足以部署多格灵兽', () => {
    const s = new Session();
    s.preparation.units = s.preparation.unlocked
      .filter((c) => c !== '4,5')
      .map((c, i) => {
        const [x, y] = c.split(',').map(Number);
        return { id: 100 + i, kind: 'ember_mouse' as const, rank: 6, position: { x, y } };
      });
    s.preparation.offers = [
      { id: 20, kind: 'sword_eagle', claimed: false },
      { id: 21, kind: 'cell', claimed: false },
    ];
    expect(preparationAdvice(s.preparation, 6, fallen).map((t) => t.id)).toEqual(['tactics']);
    s.preparation.offers.push({ id: 22, kind: 'boar', claimed: false });
    expect(preparationAdvice(s.preparation, 6, fallen).some((t) => t.id === 'deploy')).toBe(false);
  });

  it('不同种、不同阶、最高阶与已领取来源不构成合成机会', () => {
    const s = mouseSession();
    s.preparation.offers = [
      { id: 2, kind: 'ember_mouse', rank: 2, claimed: false },
      { id: 3, kind: 'boar', claimed: false },
      { id: 4, kind: 'ember_mouse', claimed: true },
    ];
    expect(preparationAdvice(s.preparation, 6, fallen).some((t) => t.id === 'merge')).toBe(false);
    s.preparation.units[0].rank = 6;
    s.preparation.offers = [{ id: 7, kind: 'ember_mouse', rank: 6, claimed: false }];
    expect(preparationAdvice(s.preparation, 6, fallen).some((t) => t.id === 'merge')).toBe(false);
  });

  it('超时提醒输出；只有桃或狐时优先提醒缺少伤害，最多三条', () => {
    const s = mouseSession();
    const recap = { ...fallen, cause: 'timeout' as const };
    expect(
      preparationAdvice(s.preparation, 6, recap).find((t) => t.id === 'tactics')?.text,
    ).toContain('输出');
    s.preparation.units[0].kind = 'fortune_peach';
    expect(preparationAdvice(s.preparation, 6, recap).some((t) => t.id === 'output')).toBe(true);
    s.preparation.units[0].kind = 'shield_fox';
    const tips = preparationAdvice(s.preparation, 6, recap);
    expect(tips.some((t) => t.id === 'output')).toBe(true);
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it('摘要与建议不修改RNG、存档和战报，不把上关复盘带入下一关', () => {
    const s = mouseSession();
    const before = clone(s.exportSave());
    const battle = createCombat(s.preparation.units);
    battle.result = 'defeat';
    const battleBefore = clone(battle);
    const recap = defeatRecap(battle)!;
    preparationAdvice(s.preparation, 6, recap);
    expect(s.exportSave()).toEqual(before);
    expect(battle).toEqual(battleBefore);
    s.preparation.stageId = 2;
    expect(preparationAdvice(s.preparation, 6, recap)).toEqual([]);
  });
});
