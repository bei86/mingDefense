import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { appearances, cells, clone } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { battleInspection } from './battle-inspection';
import { InspectionFormation, InspectionFormationBoard } from './InspectionFormation';

const noop = () => {};

describe('暂停阵线总览', () => {
  it('真实八灵每只只有一个选择按钮，完整占格与cells一致，选中实例唯一', () => {
    const s = rosterPlaytest();
    s.start();
    s.pause(true);
    const view = battleInspection(s.battle, s.preparation.units)!;
    const before = clone(s);
    const html = renderToStaticMarkup(
      createElement(InspectionFormationBoard, {
        allies: view.allies,
        selectedId: 11,
        onSelect: noop,
      }),
    );
    expect(html.match(/<button /g)).toHaveLength(8);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    for (const unit of view.allies) {
      const footprint = cells(unit.kind, unit.position);
      const width = Math.max(...footprint.map((p) => p.x)) - unit.position.x + 1;
      const height = Math.max(...footprint.map((p) => p.y)) - unit.position.y + 1;
      expect(width * height).toBe(footprint.length);
      expect(html).toContain(
        `grid-column:${unit.position.x + 1} / span ${width};grid-row:${unit.position.y + 1} / span ${height}`,
      );
      expect(html).toContain(`${appearances[unit.kind].name}${unit.rank}阶`);
    }
    expect(html).toContain('当前查看：穿林猿5阶 · 3列4行起');
    expect(s).toEqual(before);
  });

  it('同种实例按ID选中；真实存活锁定、倒下及无报告仍能显示', () => {
    const b = createCombat([
      { id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } },
      { id: 11, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 3 } },
      { id: 12, kind: 'boar', rank: 1, position: null },
    ]);
    spawnEnemy(b, 'wolf', { x: 1, y: 0 }).target = 10;
    spawnEnemy(b, 'wolf', { x: 2, y: 0 }).target = 11;
    const dead = spawnEnemy(b, 'wolf', { x: 3, y: 0 });
    dead.target = 10;
    dead.hp = 0;
    b.allies[0].hp = 60;
    b.allies[1].hp = 0;
    delete b.report;
    const view = battleInspection(b, [])!;
    const render = (selectedId: number) =>
      renderToStaticMarkup(
        createElement(InspectionFormationBoard, {
          allies: view.allies,
          selectedId,
          onSelect: noop,
        }),
      );
    const html = render(11);
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html).toContain('查看烬灵鼠1阶，2列4行起，生命60/120，被1只敌人锁定');
    expect(html).toContain('width:50%');
    expect(html).toContain('查看烬灵鼠1阶，3列4行起，已倒下');
    expect(html).toContain('当前查看：烬灵鼠1阶 · 3列4行起');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('岩甲豚');
    expect(render(10)).toContain('当前查看：烬灵鼠1阶 · 2列4行起');
    expect(render(999)).not.toContain('aria-pressed="true"');
  });

  it('总览默认收起且不绘图，空阵容不产生空的可选图', () => {
    const b = createCombat([{ id: 10, kind: 'ember_mouse', rank: 1, position: { x: 1, y: 3 } }]);
    const allies = battleInspection(b, [])!.allies;
    const html = renderToStaticMarkup(
      createElement(InspectionFormation, { allies, selectedId: 10, onSelect: noop }),
    );
    expect(html).toContain('阵线总览');
    expect(html).not.toContain(' open=');
    expect(html).not.toContain('<button');
    expect(
      renderToStaticMarkup(
        createElement(InspectionFormation, { allies: [], selectedId: undefined, onSelect: noop }),
      ),
    ).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(InspectionFormationBoard, {
          allies: [],
          selectedId: undefined,
          onSelect: noop,
        }),
      ),
    ).not.toContain('<button');
  });
});
