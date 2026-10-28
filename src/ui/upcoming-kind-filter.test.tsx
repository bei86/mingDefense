import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { stages } from '../game/content';
import { upcomingEnemies } from './upcoming-enemies';
import { UpcomingEnemyList } from './UpcomingEnemies';

const noop = () => {};
function setup() {
  const battle = createCombat([], { stageId: 50 });
  battle.spawns = Array.from({ length: 30 }, (_, i) => ({
    at: Math.floor(i / 2) * 1000,
    x: (i % 6) + 0.5,
    kind: i % 3 === 0 ? ('ranged' as const) : ('wolf' as const),
  }));
  battle.spawnIndex = 2;
  battle.time = 2500;
  return battle;
}

test('50关每种剩余队列筛选后全页拼接无重漏，绝对索引/入口/时间/顺序不变，全局摘要和Combat只读', () => {
  for (const stage of stages) {
    const battle = createCombat([], { stageId: stage.id });
    battle.spawnIndex = Math.min(2, battle.spawns.length);
    battle.time = 1050;
    spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, 999);
    const before = JSON.stringify(battle);
    const all = upcomingEnemies(battle)!;
    for (const group of all.counts) {
      const first = upcomingEnemies(battle, 0, group.kind)!;
      expect(first.kind).toBe(group.kind);
      expect(first.matched).toBe(group.count);
      const pages = Array.from(
        { length: first.pageCount },
        (_, page) => upcomingEnemies(battle, page, group.kind)!,
      );
      for (const page of pages) {
        expect(page.counts).toEqual(all.counts);
        expect(page.remaining).toBe(all.remaining);
        expect(page.next.length + page.hiddenCount).toBe(group.count);
      }
      const expected = battle.spawns.flatMap((spawn, index) =>
        index >= battle.spawnIndex && (spawn.kind ?? 'wolf') === group.kind
          ? [
              {
                index,
                kind: spawn.kind ?? 'wolf',
                at: spawn.at,
                column: Math.floor(spawn.x) + 1,
                remainingMs: Math.max(0, spawn.at - battle.time),
              },
            ]
          : [],
      );
      expect(pages.flatMap((page) => page.next).map(({ name: _name, ...entry }) => entry)).toEqual(
        expected,
      );
    }
    expect(JSON.stringify(battle)).toBe(before);
  }
});

test('稀疏索引和同刻顺序保留，分页统计只计匹配种类而非原队列offset', () => {
  const battle = setup();
  const first = upcomingEnemies(battle, 0, 'ranged')!;
  expect(first).toMatchObject({
    kind: 'ranged',
    remaining: 28,
    matched: 9,
    page: 0,
    pageCount: 2,
    hiddenCount: 1,
  });
  expect(first.next.map((e) => e.index)).toEqual([3, 6, 9, 12, 15, 18, 21, 24]);
  expect(first.next[0]).toMatchObject({ at: 1000, remainingMs: 0, column: 4 });
  const last = upcomingEnemies(battle, 999, 'ranged')!;
  expect(last).toMatchObject({ page: 1, hiddenCount: 8, next: [{ index: 27 }] });
  expect(upcomingEnemies(battle, 1, 'wolf')!.next.map((e) => e.index)).toEqual([
    14, 16, 17, 19, 20, 22, 23, 25,
  ]);
  for (const page of [-1, NaN, Infinity, -Infinity])
    expect(upcomingEnemies(battle, page, 'ranged')!.page).toBe(0);
  expect(upcomingEnemies(battle, 1.9, 'ranged')!.page).toBe(1);
});

test('消耗游标后重新统计并夹页，缺失种类回全部，旧kind按狼；结束态与空队列不伪造计划', () => {
  const battle = setup();
  battle.spawnIndex = 25;
  expect(upcomingEnemies(battle, 1, 'ranged')).toMatchObject({
    page: 0,
    pageCount: 1,
    matched: 1,
    next: [{ index: 27 }],
  });
  battle.spawnIndex = 28;
  delete battle.spawns[28].kind;
  expect(upcomingEnemies(battle, 1, 'ranged')).toMatchObject({ kind: 'all', page: 0, matched: 2 });
  expect(upcomingEnemies(battle, 0, 'wolf')!.next.map((e) => e.index)).toEqual([28, 29]);
  battle.result = 'defeat';
  expect(upcomingEnemies(battle, 0, 'wolf')).toMatchObject({
    ended: true,
    kind: 'wolf',
    remaining: 2,
    matched: 2,
  });
  battle.spawnIndex = 30;
  expect(upcomingEnemies(battle, 99, 'wolf')).toMatchObject({
    kind: 'all',
    ended: true,
    remaining: 0,
    matched: 0,
    page: 0,
    pageCount: 0,
    next: [],
  });
  expect(upcomingEnemies(null, 0, 'ranged')).toBeNull();
});

test('筛选控件显示全局种类数与匹配分页范围，档案按钮仍包含筛选外种类', () => {
  const battle = setup();
  const html = renderToStaticMarkup(
    <UpcomingEnemyList
      view={upcomingEnemies(battle, 1, 'ranged')!}
      onPage={noop}
      onKind={noop}
      onIntel={noop}
    />,
  );
  expect(html).toContain('aria-label="后续敌袭种类"');
  expect(html).toContain('<option value="all">全部 · 28只</option>');
  expect(html).toContain('<option value="ranged" selected="">翎羽客 · 9只</option>');
  expect(html).toContain('当前筛选 9 / 28 只未出场固定敌人');
  expect(html).toContain('筛选内第 9–9 只 / 共 9 只');
  expect(html).toContain('第 2 / 2 页');
  expect(html).toContain('另有 8 只符合筛选的固定敌人未在本页显示');
  expect(html).toContain('查看后续奔雷狼敌情档案，未出场19只');
  expect(html).toContain('第4列入口 · 计划 00:13');
});

test('全部保持旧分页文案，结束态仅显示未执行，空队列隐藏筛选与页码', () => {
  const battle = setup();
  const render = () =>
    renderToStaticMarkup(
      <UpcomingEnemyList
        view={upcomingEnemies(battle, 0, 'ranged')!}
        onPage={noop}
        onKind={noop}
      />,
    );
  const all = renderToStaticMarkup(
    <UpcomingEnemyList view={upcomingEnemies(battle)!} onPage={noop} onKind={noop} />,
  );
  expect(all).toContain('第 1–8 只 / 共 28 只');
  expect(all).not.toContain('筛选内第');
  battle.result = 'defeat';
  expect(render()).toContain('未执行计划');
  expect(render()).not.toContain('秒后');
  battle.spawnIndex = 30;
  expect(render()).toContain('本场固定队列已全部执行');
  expect(render()).not.toContain('aria-label="后续敌袭种类"');
  expect(render()).not.toContain('固定敌袭翻页');
  expect(render()).not.toContain('第 0');
});
