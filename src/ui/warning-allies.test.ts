import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { clone, config } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { enemyInspection } from './enemy-inspection';
import { EnemyWarnings } from './EnemyWarnings';

function setup() {
  const battle = createCombat(
    [
      { id: 10, kind: 'boar', rank: 2, position: { x: 0, y: 2 } },
      { id: 11, kind: 'ice_fish', rank: 2, position: { x: 2, y: 1 } },
      { id: 12, kind: 'sword_eagle', rank: 2, position: { x: 3, y: 2 } },
      { id: 13, kind: 'ember_mouse', rank: 1, position: { x: 5, y: 2 } },
      { id: 14, kind: 'boar', rank: 3, position: { x: 0, y: 4 } },
      { id: 15, kind: 'ember_mouse', rank: 1, position: null },
    ],
    { stageId: 5 },
  );
  battle.spawns = [];
  battle.time = 1000;
  battle.allies.find((unit) => unit.id === 13)!.hp = 0;
  for (const unit of battle.allies) unit.cooldown = 100000;
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: 0 });
  boss.cooldown = 100000;
  boss.nextCleave = 100000;
  boss.nextSummon = 100000;
  battle.warnings = [{ source: boss.id, row: 2, due: 1050 }];
  return { battle, boss };
}

describe('预警行内灵兽', () => {
  it('跨行占格包含锚点在前一行者，多格每行只计一次，排除死亡与备战且投影只读', () => {
    const { battle } = setup();
    battle.allies.reverse();
    const before = clone(battle);
    const warning = enemyInspection(battle)!.enemies[0].warnings[0];
    expect(warning.row).toBe(3);
    expect(warning.allies.map((unit) => unit.id)).toEqual([11, 10, 12]);
    expect(warning.allies[0]).toEqual({
      id: 11,
      kind: 'ice_fish',
      rank: 2,
      position: { x: 2, y: 1 },
    });
    expect(battle).toEqual(before);
    warning.allies[0].position.y = 5;
    expect(battle.allies.find((unit) => unit.id === 11)!.position.y).toBe(1);
  });

  it('真实横扫下一步释放时，受伤ID等于暂停时按占格列出的名单，不依赖缓存目标', () => {
    const { battle, boss } = setup();
    boss.target = 14;
    boss.recheckAt = 100000;
    battle.warnings[0].due = battle.time;
    const ids = enemyInspection(battle)!.enemies[0].warnings[0].allies.map((unit) => unit.id);
    const hp = new Map(battle.allies.map((unit) => [unit.id, unit.hp]));
    stepCombat(battle);
    expect(battle.warnings).toEqual([]);
    expect(
      battle.allies
        .filter((unit) => unit.hp < hp.get(unit.id)!)
        .map((unit) => unit.id)
        .sort(),
    ).toEqual([...ids].sort());
    expect(ids).not.toContain(boss.target);
  });

  it('主预警与回响保留独立名单，冻结推迟时间但不推进只读投影，空行与失效来源安全', () => {
    const { battle, boss } = setup();
    battle.warnings.push(
      { source: boss.id, row: 2, due: 1550, echo: true },
      { source: boss.id, row: 0, due: 1800 },
      { source: 999, row: 2, due: 1100 },
    );
    boss.frozenUntil = 2000;
    const before = enemyInspection(battle)!;
    expect(
      before.enemies[0].warnings.map((warning) => warning.allies.map((unit) => unit.id)),
    ).toEqual([[11, 10, 12], [11, 10, 12], []]);
    stepCombat(battle);
    expect(enemyInspection(battle)!.enemies[0].warnings).toEqual(
      before.enemies[0].warnings.map((warning) => ({
        ...warning,
        frozenMs: warning.frozenMs - config.runtime.tickMs,
      })),
    );
    battle.allies.find((unit) => unit.id === 11)!.hp = 0;
    expect(enemyInspection(battle)!.enemies[0].warnings[0].allies.map((unit) => unit.id)).toEqual([
      10, 12,
    ]);
    boss.hp = 0;
    expect(enemyInspection(battle)!.enemies).toEqual([]);
  });

  it('同名实例保留各自编号位置，预警默认折叠并有精确查看入口和当前状态说明', () => {
    const { battle, boss } = setup();
    battle.warnings = [
      { source: boss.id, row: 4, due: 1100, echo: true },
      { source: boss.id, row: 2, due: 1000 },
    ];
    battle.allies.push({ ...clone(battle.allies[0]), id: 16, position: { x: 2, y: 4 } });
    const html = renderToStaticMarkup(
      createElement(EnemyWarnings, {
        warnings: enemyInspection(battle)!.enemies[0].warnings,
        onSelect: () => {},
      }),
    );
    expect(html).toContain('第 5 行');
    expect(html).toContain('回响');
    expect(html).toContain('剩余 0.1 秒');
    expect(html).toContain('待释放');
    expect(html).toContain('预警行内 · 2只灵兽');
    expect(html).toContain('查看预警行内灵兽：岩甲豚3阶，编号14，1列5行起');
    expect(html).toContain('查看预警行内灵兽：岩甲豚2阶，编号16，3列5行起');
    expect(html).toContain('实际释放时重新判断');
    expect(html).not.toContain(' open=');
  });

  it('无预警与空行显示说明，不提供空列表和无效跳转', () => {
    const render = (
      warnings: NonNullable<ReturnType<typeof enemyInspection>>['enemies'][number]['warnings'],
    ) => renderToStaticMarkup(createElement(EnemyWarnings, { warnings, onSelect: () => {} }));
    expect(render([])).toContain('当前没有已记录预警');
    const html = render([{ row: 1, remainingMs: 0, frozenMs: 0, echo: false, allies: [] }]);
    expect(html).toContain('当前该行没有存活灵兽');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<button');
  });
});
