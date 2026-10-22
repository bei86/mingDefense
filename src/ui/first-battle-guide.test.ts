import { describe, expect, it } from 'vitest';
import { clone } from '../game/content';
import { Session } from '../game/session';
import { firstBattleGuide } from './first-battle-guide';

describe('首战整备指引', () => {
  it('正常操作串联免费招募、部署、合成、补齐阵容和开战', () => {
    const s = new Session();
    expect(firstBattleGuide(s)?.source).toEqual({ type: 'offer', id: 1 });
    expect(s.transfer(firstBattleGuide(s)!.source!, { x: 1, y: 3 })).toBeNull();
    const mouse = s.preparation.units[0];
    expect(firstBattleGuide(s)).toMatchObject({ kind: 'merge', source: { type: 'offer', id: 2 } });
    expect(firstBattleGuide(s)?.description).toContain('第2列第4行');
    expect(s.transfer(firstBattleGuide(s)!.source!, { merge: mouse.id })).toBeNull();
    expect(s.transfer(firstBattleGuide(s)!.source!, { x: 2, y: 3 })).toBeNull();
    expect(firstBattleGuide(s)?.description).toContain('2×2 格');
    expect(s.transfer(firstBattleGuide(s)!.source!, { x: 3, y: 4 })).toBeNull();
    expect(firstBattleGuide(s)?.kind).toBe('ready');
    expect(s.preparation.currency).toBe(45);
    expect(s.start()).toBeNull();
    expect(firstBattleGuide(s)).toBeNull();
  });

  it('先部署豚或两只鼠分别部署，也可推荐实际存在的合成来源', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
    expect(firstBattleGuide(s)?.source).toEqual({ type: 'offer', id: 1 });
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.transfer({ type: 'offer', id: 2 }, { x: 1, y: 4 });
    const hint = firstBattleGuide(s)!;
    expect(hint.kind).toBe('merge');
    expect(hint.source).toEqual({ type: 'unit', id: s.preparation.units[2].id });
    expect(s.transfer(hint.source!, { merge: s.preparation.units[1].id })).toBeNull();
  });

  it('优先提醒备战灵兽上阵，再把另一只合成到棋盘，撤销后重新判断', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, 'reserve');
    const source = { type: 'unit' as const, id: s.preparation.units[0].id };
    expect(firstBattleGuide(s)?.source).toEqual(source);
    expect(firstBattleGuide(s)?.description).toContain('备战席');
    s.transfer(source, { x: 1, y: 3 });
    s.transfer(firstBattleGuide(s)!.source!, { merge: source.id });
    expect(firstBattleGuide(s)?.kind).toBe('deploy');
    s.undo();
    expect(firstBattleGuide(s)?.kind).toBe('merge');
  });

  it('遣散后不再指向失效来源；刷新后不依赖初始招募ID', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.discard(s.preparation.units[0].id);
    expect(firstBattleGuide(s)?.source).toEqual({ type: 'offer', id: 2 });
    s.refresh(true);
    const hint = firstBattleGuide(s)!;
    expect(hint.kind).toBe('deploy');
    const offer = s.preparation.offers.find((o) => o.id === hint.source?.id)!;
    expect(offer.claimed).toBe(false);
    expect(offer.kind).not.toBe('cell');
  });

  it('多格灵兽放不下时跳过，保留可开战提示，不引导非法放置', () => {
    const s = new Session();
    s.preparation.units = s.preparation.unlocked
      .filter((cell) => cell !== '4,5')
      .map((cell, i) => {
        const [x, y] = cell.split(',').map(Number);
        return { id: i + 100, kind: 'ember_mouse' as const, rank: 2, position: { x, y } };
      });
    s.preparation.offers = [{ id: 20, kind: 'sword_eagle', claimed: false }];
    expect(firstBattleGuide(s)?.kind).toBe('ready');
    expect(firstBattleGuide(s)?.source).toBeUndefined();
    s.preparation.offers.push({ id: 21, kind: 'boar', claimed: false });
    expect(firstBattleGuide(s)?.kind).toBe('ready');
    s.preparation.offers.push({ id: 22, kind: 'fortune_peach', claimed: false });
    expect(firstBattleGuide(s)?.source).toEqual({ type: 'offer', id: 22 });
  });

  it('仅有扩地令或无可用灵兽时不伪造合成任务，也不标记可开战', () => {
    const s = new Session();
    s.preparation.offers = [{ id: 12, kind: 'cell', claimed: false }];
    expect(firstBattleGuide(s)?.kind).toBe('recruit');
    expect(firstBattleGuide(s)?.source).toBeUndefined();
    s.preparation.offers = [];
    expect(firstBattleGuide(s)?.kind).toBe('recruit');
    s.preparation.units.push({ id: 100, kind: 'ember_mouse', rank: 6, position: { x: 1, y: 3 } });
    expect(firstBattleGuide(s)?.kind).toBe('ready');
  });

  it('恢复首关存档得到同一提示，推导不修改存档、RNG或revision', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    const before = clone(s.exportSave());
    const revision = s.revision;
    const restored = Session.restore(before);
    expect(firstBattleGuide(restored)).toEqual(firstBattleGuide(s));
    expect(s.exportSave()).toEqual(before);
    expect(s.revision).toBe(revision);
  });

  it.each(['combat', 'victory', 'defeat'] as const)('%s阶段不显示指引', (phase) => {
    const s = new Session();
    s.phase = phase;
    expect(firstBattleGuide(s)).toBeNull();
  });

  it('第二关整备不显示；回到首关整备恢复提示', () => {
    const s = new Session();
    s.preparation.stageId = 2;
    expect(firstBattleGuide(s)).toBeNull();
    s.reset();
    expect(firstBattleGuide(s)?.kind).toBe('deploy');
  });
});
