import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { appearances, clone, heroIds } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { Session, type Source } from '../game/session';
import { BattleInspection } from './BattleInspection';
import { PreparationPanel } from './PreparationPanel';
import { SpiritHandbook } from './SpiritHandbook';

const noop = () => {};

function preparation(session: Session, selected: Source | null): string {
  return renderToStaticMarkup(
    createElement(PreparationPanel, {
      session,
      selected,
      message: '',
      choose: noop,
      dragStart: noop,
      run: noop,
      confirm: noop,
      onStart: noop,
      onSwap: noop,
      onPresets: noop,
      onMergePreview: noop,
      onHandbook: noop,
      fieldReady: true,
      ignoreClick: () => false,
    }),
  );
}

describe('灵兽图鉴上下文入口', () => {
  it('八灵六阶打开对应基础值与技能；全局默认仍鼠1阶', () => {
    for (const kind of heroIds) {
      for (let rank = 1; rank <= 6; rank++) {
        const html = renderToStaticMarkup(
          createElement(SpiritHandbook, {
            initialEntry: { kind, rank },
            onClose: noop,
            closeLabel: '返回战场详情',
          }),
        );
        expect(html).toContain(`<h3>${appearances[kind].name} · ${rank}阶</h3>`);
        expect(html).toContain('当前原型基础值，未计入本轮加成');
        expect(html).toContain('返回战场详情');
      }
    }
    expect(renderToStaticMarkup(createElement(SpiritHandbook, { onClose: noop }))).toContain(
      '<h3>烬灵鼠 · 1阶</h3>',
    );
  });

  it('整备上阵/备战及二阶待领招募带实际种类阶数，无效来源无入口且查看不改Session', () => {
    const s = rosterPlaytest();
    const before = clone(s.exportSave());
    expect(preparation(s, { type: 'unit', id: 11 })).toContain('查看穿林猿5阶技能图鉴');
    expect(s.exportSave()).toEqual(before);
    s.transfer({ type: 'unit', id: 8 }, 'reserve');
    expect(preparation(s, { type: 'unit', id: 8 })).toContain('查看月音狐3阶技能图鉴');
    s.preparation.offers = [
      { id: 100, kind: 'shield_fox', rank: 2, claimed: false },
      { id: 101, kind: 'cell', claimed: false },
      { id: 102, kind: 'ice_fish', claimed: false },
      { id: 103, kind: 'boar', claimed: true },
    ];
    expect(preparation(s, { type: 'offer', id: 100 })).toContain('查看月音狐2阶技能图鉴');
    expect(preparation(s, { type: 'offer', id: 102 })).toContain('查看霜尾鲤1阶技能图鉴');
    for (const selected of [
      null,
      { type: 'offer' as const, id: 101 },
      { type: 'offer' as const, id: 103 },
      { type: 'unit' as const, id: 999 },
    ]) {
      expect(preparation(s, selected)).not.toContain('技能图鉴');
    }
  });

  it('暂停详情保留实际默认目标及倒下者的图鉴入口；隐藏详情仍保留内容且不修改战斗', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 3 }, { x: 1, y: 3 });
    s.start();
    s.pause(true);
    const render = (suspended: boolean) =>
      renderToStaticMarkup(
        createElement(BattleInspection, {
          session: s,
          onClose: noop,
          onHandbook: noop,
          suspended,
        }),
      );
    const before = clone(s.exportSave());
    expect(render(false)).toContain('查看岩甲豚1阶技能图鉴');
    expect(s.exportSave()).toEqual(before);
    s.battle!.allies[0].hp = 0;
    expect(render(false)).toContain('查看岩甲豚1阶技能图鉴');
    const hidden = render(true);
    expect(hidden).toContain('hidden=""');
    expect(hidden).toContain('查看岩甲豚1阶技能图鉴');
  });
});
