import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat } from '../game/combat';
import { stages } from '../game/content';
import { spawnEnemy } from '../game/combat-skills';
import { upcomingEnemies } from './upcoming-enemies';
import { UpcomingEnemyList } from './UpcomingEnemies';
import { StageIntel } from './StageIntel';

const noop = () => {};
function setup(count = 17) {
  const battle = createCombat([], { stageId: 50 });
  battle.spawns = Array.from({ length: count }, (_, i) => ({
    at: i * 1000,
    x: (i % 6) + 0.5,
    kind: i === 0 ? ('boss' as const) : ('wolf' as const),
  }));
  return battle;
}

test('50关真实队列全页拼接无重漏，游标后绝对index与顺序一致且完整JSON只读', () => {
  for (const stage of stages) {
    const battle = createCombat([], { stageId: stage.id });
    battle.spawnIndex = Math.min(2, battle.spawns.length);
    battle.time = 1050;
    spawnEnemy(battle, 'summoned_wolf', { x: 1, y: 0 }, 999);
    const before = JSON.stringify(battle);
    const first = upcomingEnemies(battle)!;
    const all = Array.from(
      { length: first.pageCount },
      (_, page) => upcomingEnemies(battle, page)!,
    ).flatMap((view) => {
      expect(view.counts).toEqual(first.counts);
      expect(view.next.length + view.hiddenCount).toBe(first.remaining);
      expect(view.next.length).toBeLessThanOrEqual(8);
      return view.next;
    });
    expect(all.map((entry) => entry.index)).toEqual(
      battle.spawns.slice(battle.spawnIndex).map((_, i) => battle.spawnIndex + i),
    );
    expect(
      all.map(({ kind, at, column, remainingMs }) => ({ kind, at, column, remainingMs })),
    ).toEqual(
      battle.spawns.slice(battle.spawnIndex).map((entry) => ({
        kind: entry.kind ?? 'wolf',
        at: entry.at,
        column: Math.floor(entry.x) + 1,
        remainingMs: Math.max(0, entry.at - battle.time),
      })),
    );
    expect(JSON.stringify(battle)).toBe(before);
  }
});

test.each([
  [8, 1, 8],
  [9, 2, 1],
  [16, 2, 8],
  [17, 3, 1],
])('%s条队列为%s页，最后一页%s条，默认仍是首8只', (count, pages, lastCount) => {
  const battle = setup(count);
  expect(upcomingEnemies(battle)).toMatchObject({ page: 0, pageCount: pages });
  expect(upcomingEnemies(battle)!.next.map((entry) => entry.index)).toEqual(
    Array.from({ length: 8 }, (_, i) => i),
  );
  expect(upcomingEnemies(battle, 999)!.next).toHaveLength(lastCount);
  expect(upcomingEnemies(battle, 999)!.page).toBe(pages - 1);
});

test('无效页归一、小数向下取整；游标推进后夹至最后页，数量与倒计时重新读取', () => {
  const battle = setup();
  for (const page of [-1, NaN, Infinity, -Infinity])
    expect(upcomingEnemies(battle, page)!.page).toBe(0);
  expect(upcomingEnemies(battle, 1.9)!.next[0].index).toBe(8);
  battle.spawnIndex = 10;
  battle.time = 12550;
  const last = upcomingEnemies(battle, 2)!;
  expect(last).toMatchObject({ page: 0, pageCount: 1, remaining: 7, hiddenCount: 0 });
  expect(last.next[0]).toMatchObject({ index: 10, remainingMs: 0 });
  expect(last.next[3]).toMatchObject({ index: 13, remainingMs: 450 });
});

test('空/结束态与旧kind沿用语义，页码不伪造未来敌人', () => {
  expect(upcomingEnemies(null, 5)).toBeNull();
  const battle = setup(1);
  delete battle.spawns[0].kind;
  battle.result = 'defeat';
  expect(upcomingEnemies(battle, 4)).toMatchObject({
    page: 0,
    pageCount: 1,
    ended: true,
    next: [{ kind: 'wolf' }],
  });
  battle.spawnIndex = 1;
  expect(upcomingEnemies(battle, 4)).toMatchObject({
    page: 0,
    pageCount: 0,
    remaining: 0,
    next: [],
  });
});

test('分页控件显示范围、首尾禁用及本页外数量，不误称全部排在其后', () => {
  const battle = setup();
  function render(page: number) {
    return renderToStaticMarkup(
      <UpcomingEnemyList view={upcomingEnemies(battle, page)!} onPage={noop} />,
    );
  }
  const first = render(0),
    middle = render(1),
    last = render(2);
  expect(first).toContain('第 1–8 只 / 共 17 只');
  expect(first).toContain('aria-label="上一页固定敌袭" disabled=""');
  expect(middle).toContain('第 9–16 只 / 共 17 只');
  expect(middle).toContain('第 2 / 3 页');
  expect(middle).toContain('另有 9 只固定敌人未在本页显示');
  expect(middle).not.toContain('排在其后');
  expect(last).toContain('第 17–17 只 / 共 17 只');
  expect(last).toContain('aria-label="下一页固定敌袭" disabled=""');
});

test('剩余种类入口覆盖本页外种类并标明总数差异，无回调保持纯文字', () => {
  const battle = setup();
  battle.spawnIndex = 1;
  battle.spawns[16].kind = 'ranged';
  const before = JSON.stringify(battle);
  const view = upcomingEnemies(battle)!;
  const linked = renderToStaticMarkup(
    <UpcomingEnemyList view={view} onPage={noop} onIntel={noop} />,
  );
  expect(linked).toContain('aria-label="查看后续翎羽客敌情档案，未出场1只"');
  expect(linked).toContain('档案中的固定数量是本关总数');
  expect(linked).not.toContain('查看后续镇渊妖君');
  const plain = renderToStaticMarkup(<UpcomingEnemyList view={view} onPage={noop} />);
  expect(plain).not.toContain('查看后续翎羽客敌情档案');
  expect(plain).toContain('翎羽客 ×1');
  const intel = renderToStaticMarkup(
    <StageIntel
      currentStageId={50}
      currentSpawns={battle.spawns}
      initialEnemyKind="wolf"
      onClose={noop}
    />,
  );
  expect(intel).toContain('固定 15 只');
  expect(JSON.stringify(battle)).toBe(before);
});

test('仅一页/空队列无多余导航，结束态显示未执行不冒充即将出场', () => {
  const battle = setup(9);
  battle.result = 'defeat';
  const ended = renderToStaticMarkup(
    <UpcomingEnemyList view={upcomingEnemies(battle, 1)!} onPage={noop} />,
  );
  expect(ended).toContain('未执行计划');
  expect(ended).toContain('不会继续出场');
  expect(ended).not.toContain('秒后');
  battle.spawnIndex = 1;
  expect(
    renderToStaticMarkup(<UpcomingEnemyList view={upcomingEnemies(battle)!} onPage={noop} />),
  ).not.toContain('固定敌袭翻页');
  battle.spawnIndex = 9;
  const empty = renderToStaticMarkup(
    <UpcomingEnemyList view={upcomingEnemies(battle)!} onPage={noop} onIntel={noop} />,
  );
  expect(empty).not.toContain('固定敌袭翻页');
  expect(empty).not.toContain('查看后续');
  expect(empty).not.toContain('第 0');
});
