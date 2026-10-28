import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { battleStats } from './battle-stats';
import { AuraSources } from './AuraSources';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 10, kind: 'ember_mouse', rank: 4, position: { x: 0, y: 0 } },
    { id: 0, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } },
    { id: 22, kind: 'shield_fox', rank: 3, position: { x: 0, y: 1 } },
    { id: 33, kind: 'shield_fox', rank: 6, position: { x: 1, y: 2 } },
    { id: 44, kind: 'shield_fox', rank: 2, position: { x: 2, y: 0 } },
    { id: 55, kind: 'shield_fox', rank: 6, position: { x: 5, y: 3 } },
  ]);
  battle.allies[3].hp = 0;
  return battle;
}

test('真实光环来源按准确编号显示，同阶多狐与编号0可辨认，排除倒下/低阶/范围外，渲染只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const sources = battleStats(battle, 10)!.auraSources;
  expect(sources.map((source) => source.id)).toEqual([0, 22]);
  const html = renderToStaticMarkup(<AuraSources sources={sources} onSelect={noop} />);
  expect(html).toContain('aria-label="存活攻击光环来源"');
  expect(html).toContain('aria-label="查看光环来源：月音狐3阶，2列1行，编号0"');
  expect(html).toContain('aria-label="查看光环来源：月音狐3阶，1列2行，编号22"');
  expect(html.match(/type="button"/g)).toHaveLength(2);
  expect(html.match(/查看来源/g)).toHaveLength(2);
  for (const id of [33, 44, 55]) expect(html).not.toContain(`编号${id}`);
  expect(JSON.stringify(battle)).toBe(before);
});

test('无覆盖、倒下的攻击灵兽、狐及桃均没有来源入口', () => {
  const battle = setup();
  for (const id of [0, 22]) {
    expect(
      renderToStaticMarkup(
        <AuraSources sources={battleStats(battle, id)!.auraSources} onSelect={noop} />,
      ),
    ).toBe('');
  }
  battle.allies[0].kind = 'fortune_peach';
  expect(battleStats(battle, 10)!.auraSources).toEqual([]);
  battle.allies[0].kind = 'ember_mouse';
  battle.allies[0].hp = 0;
  expect(battleStats(battle, 10)!.auraSources).toEqual([]);
  battle.allies[0].hp = battle.allies[0].maxHp;
  battle.allies[1].hp = 0;
  battle.allies[2].hp = 0;
  expect(
    renderToStaticMarkup(
      <AuraSources sources={battleStats(battle, 10)!.auraSources} onSelect={noop} />,
    ),
  ).toBe('');
});
