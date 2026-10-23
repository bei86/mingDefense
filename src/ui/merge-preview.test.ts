import { describe, expect, it } from 'vitest';
import { clone, heroIds, heroes, type HeroId } from '../game/content';
import { maxHeroHp } from '../game/combat-skills';
import { mergeError, Session, sourceUnit, type Source } from '../game/session';
import { mergeLocation, mergePreview } from './merge-preview';
import { spiritHandbookEntry } from './spirit-handbook';

function setup(kind: HeroId = 'ember_mouse', rank = 1) {
  const session = new Session();
  session.preparation.unlocked = Array.from(
    { length: 36 },
    (_, i) => `${i % 6},${Math.floor(i / 6)}`,
  );
  session.preparation.units = [
    { id: 10, kind, rank, position: { x: 0, y: 0 } },
    { id: 11, kind, rank, position: { x: 3, y: 3 } },
  ];
  session.preparation.offers = [{ id: 1, kind, rank, claimed: false }];
  session.preparation.nextId = 12;
  return session;
}

describe('合成预览与实际事务一致', () => {
  it.each(heroIds)('%s各阶预览和实际合成一致，纯读取、留目标身份位置并可撤销', (kind) => {
    for (let rank = 1; rank < 6; rank++) {
      const s = setup(kind, rank);
      const p = s.preparation;
      const before = clone(p);
      const source: Source = { type: 'unit', id: 10 };
      const preview = mergePreview(p, source, s.maxRank);
      if ('error' in preview) throw new Error(preview.error);
      expect(preview.candidates.map((u) => u.id)).toEqual([11]);
      expect(preview.stats.map((row) => row.before)).toEqual(
        spiritHandbookEntry(kind, rank)
          .stats.slice(0, 4)
          .map((row) => row.value),
      );
      expect(preview.stats.map((row) => row.after)).toEqual(
        spiritHandbookEntry(kind, rank + 1)
          .stats.slice(0, 4)
          .map((row) => row.value),
      );
      expect(preview.combinedHp).toBe(maxHeroHp(p.units[0], p.progression) * 2);
      expect(s.preparation).toEqual(before);
      expect(s.canUndo).toBe(false);
      expect(s.revision).toBe(0);
      expect(s.transfer(source, { merge: 11 })).toBeNull();
      const survivor = s.preparation.units[0];
      expect(survivor).toEqual({ ...before.units[1], rank: rank + 1 });
      expect(maxHeroHp(survivor, s.preparation.progression)).toBe(preview.resultHp);
      expect({ ...s.preparation, units: before.units }).toEqual(before);
      expect(s.undo()).toBeNull();
      expect(s.preparation).toEqual(before);
    }
  });

  it.each(['unit', 'offer'] as const)('满备战席时%s来源可直接合成到备战目标，仍不参战', (type) => {
    const s = setup('sword_eagle', 2);
    s.preparation.units[1].position = null;
    s.preparation.units.push({ id: 13, kind: 'ice_fish', rank: 1, position: null });
    s.preparation.nextId = 14;
    const source: Source = { type, id: type === 'unit' ? 10 : 1 };
    const before = clone(s.preparation);
    const preview = mergePreview(s.preparation, source, s.maxRank);
    if ('error' in preview) throw new Error(preview.error);
    expect(preview.candidates.some((u) => u.id === 11)).toBe(true);
    expect(mergeLocation(s.preparation, s.preparation.units[1])).toBe('备战席1（不参战）');
    expect(s.transfer(source, { merge: 11 })).toBeNull();
    expect(s.preparation.units.find((u) => u.id === 11)).toEqual({ ...before.units[1], rank: 3 });
    expect(s.preparation.units.filter((u) => !u.position)).toHaveLength(2);
    if (type === 'offer') {
      expect(s.preparation.offers[0].claimed).toBe(true);
      expect(s.preparation.nextId).toBe(before.nextId + 1);
      expect(s.preparation.units.find((u) => u.id === 10)).toEqual(before.units[0]);
    }
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before);
  });

  it('满棋盘与两只备战单位均可合成，不要求新空地；来源备战席腾出', () => {
    const s = setup();
    s.preparation.units = Array.from({ length: 36 }, (_, i) => ({
      id: i + 10,
      kind: 'ember_mouse',
      rank: 1,
      position: { x: i % 6, y: Math.floor(i / 6) },
    }));
    expect(mergeError(s.preparation, { type: 'unit', id: 10 }, 11, 6)).toBeNull();
    expect(s.transfer({ type: 'unit', id: 10 }, { merge: 11 })).toBeNull();
    expect(s.preparation.units).toHaveLength(35);
    const reserve = setup('shield_fox', 2);
    reserve.preparation.units.forEach((u) => {
      u.position = null;
    });
    const preview = mergePreview(reserve.preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in preview) throw new Error(preview.error);
    expect(preview.sourceRelease).toContain('1个备战席');
    expect(reserve.transfer({ type: 'unit', id: 10 }, { merge: 11 })).toBeNull();
    expect(reserve.preparation.units).toHaveLength(1);
    expect(reserve.preparation.units[0].position).toBeNull();
  });

  it('候选排除自身、不同种/阶及未领取招募，不会把招募当作目标', () => {
    const s = setup();
    s.preparation.units[1].rank = 2;
    s.preparation.units.push({ id: 12, kind: 'boar', rank: 1, position: null });
    s.preparation.nextId = 13;
    const preview = mergePreview(s.preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in preview) throw new Error(preview.error);
    expect(preview.candidates).toEqual([]);
    expect(mergeError(s.preparation, { type: 'unit', id: 10 }, 1, 6)).toBe(
      '只有同种、同阶灵兽可以合成',
    );
  });

  it.each([3, 6])('达到模式上限%s时预览与实际命令均拒绝', (cap) => {
    const s = new Session(20261014, cap === 3 ? 'm1' : 'campaign');
    s.preparation = setup('boar', cap).preparation;
    const before = clone(s.preparation);
    expect(mergePreview(s.preparation, { type: 'unit', id: 10 }, cap)).toEqual({
      error: `已达本模式最高${cap}阶，无法继续合成。`,
    });
    expect(mergeError(s.preparation, { type: 'unit', id: 10 }, 11, cap)).toBe(
      `本模式最高为 ${cap} 阶`,
    );
    expect(s.transfer({ type: 'unit', id: 10 }, { merge: 11 })).toBe(`本模式最高为 ${cap} 阶`);
    expect(s.preparation).toEqual(before);
  });

  it('初始未标阶数的招募按一阶预览，直接合成正常领取且不会额外增加单位', () => {
    const s = new Session();
    expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
    const p = clone(s.preparation);
    const source: Source = { type: 'offer', id: 2 };
    const preview = mergePreview(s.preparation, source, s.maxRank);
    if ('error' in preview) throw new Error(preview.error);
    expect(preview.unit.rank).toBe(1);
    expect(preview.sourceLocation).toBe('未领取招募');
    expect(preview.candidates.map((unit) => unit.id)).toEqual([5]);
    expect(s.preparation).toEqual(p);
    expect(s.transfer(source, { merge: 5 })).toBeNull();
    expect(s.preparation.units).toHaveLength(1);
    expect(s.preparation.offers.find((offer) => offer.id === 2)?.claimed).toBe(true);
    expect(s.preparation.units[0].rank).toBe(2);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(p);
  });

  it.each(['missing', 'claimed', 'cell'] as const)(
    '来源%s失效，不返回可确认预览且原事务无副作用',
    (reason) => {
      const s = setup();
      if (reason === 'claimed') s.preparation.offers[0].claimed = true;
      if (reason === 'cell') s.preparation.offers[0].kind = 'cell';
      const source: Source = { type: 'offer', id: reason === 'missing' ? 999 : 1 };
      const before = clone(s.preparation);
      expect(sourceUnit(s.preparation, source)).toBeNull();
      expect(mergePreview(s.preparation, source, 6)).toHaveProperty('error');
      expect(s.transfer(source, { merge: 11 })).toBe('请先选择一只灵兽');
      expect(s.preparation).toEqual(before);
      expect(s.revision).toBe(0);
    },
  );

  it('目标失效后的提交再次验证，不能改选另一只或丢掉既有撤销', () => {
    const s = setup();
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 0, y: 1 })).toBeNull();
    const before = clone(s.preparation);
    const revision = s.revision;
    expect(mergeError(s.preparation, { type: 'unit', id: 10 }, 999, 6)).toBeTruthy();
    expect(s.transfer({ type: 'unit', id: 10 }, { merge: 999 })).toBeTruthy();
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBeNull();
    expect(s.preparation.units[0].position).toEqual({ x: 0, y: 0 });
    expect(s.start()).toBeNull();
    const atStart = clone(s.preparation);
    expect(s.transfer({ type: 'unit', id: 10 }, { merge: 11 })).toBe('战斗期间无法调整阵容');
    expect(s.preparation).toEqual(atStart);
  });

  it('桃显示产钱间隔，狐显示施盾，不把天赋描述当升阶解锁', () => {
    const peach = setup('fortune_peach', 4);
    const p = mergePreview(peach.preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in p) throw new Error(p.error);
    expect(p.stats.find((r) => r.label === '产钱间隔')).toEqual({
      label: '产钱间隔',
      before: '14 秒',
      after: '6 秒',
    });
    expect(p.stats.find((r) => r.label === '每次产钱')?.after).toBe('1 灵钱');
    const fox = setup('shield_fox', 2);
    const f = mergePreview(fox.preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in f) throw new Error(f.error);
    expect(f.stats.find((r) => r.label === '每次施盾')?.after).toContain('目标生命上限');
    expect(f.newSkills.map((skill) => skill.name)).toContain('月音光环');
    const mouse = mergePreview(setup().preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in mouse) throw new Error(mouse.error);
    expect(mouse.newSkills).toEqual([]);
  });

  it('新解锁只取当前跨阶技能，五阶狐、猴等不重复已有能力', () => {
    for (const kind of heroIds) {
      for (const rank of [2, 4]) {
        const s = setup(kind, rank);
        const preview = mergePreview(s.preparation, { type: 'unit', id: 10 }, 6);
        if ('error' in preview) throw new Error(preview.error);
        expect(
          preview.newSkills.every((skill) => skill.fromRank === rank + 1 && !skill.requiresTalent),
        ).toBe(true);
      }
    }
  });

  it('双只合计和合成后生命带入本轮生命天赋，不能用单只增长冒充总增长', () => {
    const s = setup();
    s.preparation.progression.buffs = { health: 1 };
    const preview = mergePreview(s.preparation, { type: 'unit', id: 10 }, 6);
    if ('error' in preview) throw new Error(preview.error);
    expect(preview.combinedHp).toBe(
      maxHeroHp(s.preparation.units[0], s.preparation.progression) * 2,
    );
    expect(preview.resultHp).toBe(
      maxHeroHp({ ...s.preparation.units[1], rank: 2 }, s.preparation.progression),
    );
    expect(preview.stats[0].before).toBe(String(heroes.ember_mouse.hp[0]));
    expect(preview.combinedHp).not.toBe(heroes.ember_mouse.hp[0] * 2);
  });
});
