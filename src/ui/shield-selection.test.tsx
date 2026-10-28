import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { battleInspection } from './battle-inspection';
import { selectAllies } from './ally-selection';
import { allySortLabel, sortAllies } from './ally-sorting';
import { AllySelection } from './AllySelection';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 0, kind: 'ember_mouse', rank: 1, position: { x: 0, y: 0 } },
    { id: 1, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 1 } },
    { id: 2, kind: 'ember_mouse', rank: 2, position: { x: 1, y: 1 } },
    { id: 3, kind: 'shield_fox', rank: 3, position: { x: 5, y: 5 } },
    { id: 4, kind: 'fortune_peach', rank: 3, position: { x: 5, y: 4 } },
    { id: 5, kind: 'boar', rank: 1, position: { x: 2, y: 0 } },
    { id: 6, kind: 'shield_fox', rank: 3, position: null },
    { id: 7, kind: 'ember_mouse', rank: 2, position: { x: 0, y: 2 } },
  ]);
  battle.time = 1000;
  Object.assign(battle.allies.find((unit) => unit.id === 0)!, {
    shield: 20.2,
    shieldExpires: 1001,
  });
  Object.assign(battle.allies.find((unit) => unit.id === 1)!, { shield: 5, shieldExpires: 3000 });
  Object.assign(battle.allies.find((unit) => unit.id === 2)!, { shield: 100, shieldExpires: 1000 });
  Object.assign(battle.allies.find((unit) => unit.id === 3)!, {
    hp: 0,
    shield: 999,
    shieldExpires: 3000,
  });
  Object.assign(battle.allies.find((unit) => unit.id === 5)!, {
    shield: 20.1,
    shieldExpires: 3000,
  });
  Object.assign(battle.allies.find((unit) => unit.id === 7)!, { shield: -1, shieldExpires: 3000 });
  battle.report!.units.find((unit) => unit.id === 1)!.shieldGiven = 1000;
  battle.allies.reverse();
  return battle;
}

test('仅按有效盾区分存活者，过期/非正盾/倒下旧盾/备战不混入，按种类计数守恒且只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const view = battleInspection(battle, [])!;
  const snapshot = JSON.stringify(view);
  const shielded = selectAllies(view.allies, 'all', 'shielded', 0);
  const unshielded = selectAllies(view.allies, 'all', 'unshielded', 0);
  expect(shielded.allies.map((unit) => unit.id)).toEqual([0, 5, 1]);
  expect(unshielded.allies.map((unit) => unit.id)).toEqual([2, 7, 4]);
  expect(shielded.counts).toEqual({ all: 7, alive: 6, fallen: 1, shielded: 3, unshielded: 3 });
  for (const kind of ['all', 'ember_mouse', 'shield_fox', 'fortune_peach', 'boar'] as const) {
    const selection = selectAllies(view.allies, kind, 'shielded', undefined);
    expect(selection.counts.shielded + selection.counts.unshielded).toBe(selection.counts.alive);
    expect(selection.allies).toHaveLength(selection.counts.shielded);
  }
  expect(selectAllies(view.allies, 'ember_mouse', 'unshielded', 7).counts).toEqual({
    all: 4,
    alive: 4,
    fallen: 0,
    shielded: 2,
    unshielded: 2,
  });
  expect(selectAllies(view.allies, 'all', 'fallen', 3).allies.map((unit) => unit.id)).toEqual([3]);
  expect(JSON.stringify(view)).toBe(snapshot);
  expect(JSON.stringify(battle)).toBe(before);
});

test('按当前盾量降序，与累计施盾区分；显示取原投影值，同值按站位/编号，缺值排末尾', () => {
  const battle = setup();
  const allies = battleInspection(battle, [])!.allies.reverse();
  const before = JSON.stringify(allies);
  expect(sortAllies(allies, 'shield').map((unit) => unit.id)).toEqual([0, 5, 1, 2, 7, 4, 3]);
  expect(sortAllies(allies, 'shieldGiven')[0].id).toBe(1);
  expect(allySortLabel(allies.find((unit) => unit.id === 0)!, 'shield')).toBe('当前盾 21');
  expect(allySortLabel(allies.find((unit) => unit.id === 3)!, 'shield')).toBe('当前盾 0');
  expect(JSON.stringify(allies)).toBe(before);
  delete battle.report;
  expect(sortAllies(battleInspection(battle, [])!.allies, 'shield')[0].id).toBe(0);
  const tied = allies.map((unit) => ({ ...unit, position: { x: 0, y: 0 }, shield: 0 }));
  expect(sortAllies(tied, 'shield').map((unit) => unit.id)).toEqual([0, 1, 2, 3, 4, 5, 7]);
  tied[0].shield = NaN;
  expect(sortAllies(tied, 'shield').at(-1)?.id).toBe(tied[0].id);
  expect(allySortLabel(tied[0], 'shield')).toBe('当前盾 未记录');
  expect(sortAllies([], 'shield')).toEqual([]);
});

test('保持编号0和当前排序，失配选筛选内首只，空交集不回退，空投影安全', () => {
  const allies = battleInspection(setup(), [])!.allies;
  expect(selectAllies(allies, 'all', 'shielded', 0, 'shield').selectedId).toBe(0);
  expect(selectAllies(allies, 'all', 'shielded', 1, 'shield').selectedId).toBe(1);
  expect(selectAllies(allies, 'all', 'unshielded', 0, 'shield').selectedId).toBe(2);
  const empty = selectAllies(allies, 'fortune_peach', 'shielded', 0, 'shield');
  expect(empty).toMatchObject({
    status: 'shielded',
    order: 'shield',
    selectedId: undefined,
    allies: [],
  });
  expect(selectAllies(allies, 'all', 'all', 1, 'shield').selectedId).toBe(1);
  for (const status of ['shielded', 'unshielded'] as const) {
    expect(selectAllies(null, 'all', status, 0, 'shield')).toMatchObject({
      allies: [],
      selectedId: undefined,
      counts: { all: 0, alive: 0, fallen: 0, shielded: 0, unshielded: 0 },
    });
  }
});

test('真实施盾与到期后重新读取即更新分组，不缓存旧盾或按准备动作猜测', () => {
  const battle = createCombat([
    { id: 0, kind: 'fortune_peach', rank: 1, position: { x: 1, y: 3 } },
    { id: 1, kind: 'shield_fox', rank: 3, position: { x: 2, y: 3 } },
  ]);
  battle.spawns = [];
  battle.allies[0].hp = 1;
  spawnEnemy(battle, 'wolf', { x: 1, y: -8 });
  const read = () =>
    selectAllies(battleInspection(battle, [])!.allies, 'all', 'shielded', 0, 'shield');
  expect(read().allies).toEqual([]);
  stepCombat(battle);
  expect(battle.attacks.some((action) => action.source === 1)).toBe(true);
  expect(read().allies).toEqual([]);
  for (let tick = 0; tick < 20 && !battle.allies[0].shield; tick++) stepCombat(battle);
  expect(read().allies.map((unit) => unit.id)).toContain(0);
  battle.allies[1].cooldown = 1e8;
  battle.time = battle.allies[0].shieldExpires!;
  expect(read().allies).toEqual([]);
  stepCombat(battle);
  expect(battle.allies[0].shield).toBe(0);
  expect(read().allies).toEqual([]);
});

test('控件显示两组存活数与当前盾标签，空交集仍有筛选/排序，无逐只导航', () => {
  const allies = battleInspection(setup(), [])!.allies;
  const render = (kind: 'all' | 'fortune_peach') =>
    renderToStaticMarkup(
      <AllySelection
        selection={selectAllies(allies, kind, 'shielded', 0, 'shield')}
        onKind={noop}
        onStatus={noop}
        onSelect={noop}
        onOrder={noop}
      />,
    );
  const html = render('all');
  expect(html).toContain('<option value="shielded" selected="">有护盾（存活） · 3只</option>');
  expect(html).toContain('<option value="unshielded">无护盾（存活） · 3只</option>');
  expect(html).toContain('<option value="shield" selected="">当前护盾 · 从高到低</option>');
  expect(html).toContain('当前盾 21');
  expect(html).toContain('<option value="0" selected="">当前盾 21 · 烬灵鼠');
  expect(html).toContain('当前护盾仅计仍有效的盾量');
  expect(html).toContain('护盾筛选只计存活灵兽');
  const empty = render('fortune_peach');
  expect(empty).toContain('aria-label="灵兽状态"');
  expect(empty).toContain('aria-label="灵兽排序"');
  expect(empty).toContain('当前筛选下没有上阵灵兽');
  expect(empty).not.toContain('aria-label="查看灵兽"');
  expect(empty).not.toContain('逐只查看灵兽');
});
