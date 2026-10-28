import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { shieldTarget, spawnEnemy } from '../game/combat-skills';
import { clone, heroes } from '../game/content';
import { incomingShields } from './incoming-shields';
import { shieldCoverage, shieldSources } from './shield-coverage';
import { ShieldSources } from './ShieldSources';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 30, kind: 'shield_fox', rank: 1, position: { x: 2, y: 2 } },
    { id: 0, kind: 'shield_fox', rank: 2, position: { x: 1, y: 2 } },
    { id: 20, kind: 'shield_fox', rank: 3, position: { x: 5, y: 0 } },
    { id: 10, kind: 'shield_fox', rank: 6, position: { x: 4, y: 3 } },
    { id: 40, kind: 'boar', rank: 4, position: { x: 4, y: 2 } },
    { id: 50, kind: 'fortune_peach', rank: 4, position: { x: 2, y: 3 } },
    { id: 12, kind: 'ember_mouse', rank: 3, position: { x: 1, y: 0 } },
    { id: 14, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 5 } },
    { id: 70, kind: 'scatter_bear', rank: 4, position: { x: 0, y: 3 } },
    { id: 80, kind: 'shield_fox', rank: 6, position: null },
    { id: 81, kind: 'ember_mouse', rank: 6, position: null },
  ]);
  battle.allies.find((unit) => unit.id === 10)!.hp = 0;
  return battle;
}

test('每个伙伴与每只狐的前后向名单互逆，低阶狐/桃/自身/来源0合法，多格边界与shieldTarget一致且只读', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  expect(shieldSources(battle, 40)!.sources.map((source) => source.id)).toEqual([20, 30]);
  expect(shieldSources(battle, 0)!.sources.map((source) => source.id)).toEqual([0, 30]);
  expect(shieldSources(battle, 50)!.sources.map((source) => source.id)).toEqual([0, 30]);
  for (const target of battle.allies) {
    const sources = shieldSources(battle, target.id)!.sources;
    for (const source of battle.allies) {
      const covered = sources.some((entry) => entry.id === source.id);
      expect(covered).toBe(
        shieldCoverage(battle, source.id)?.targets.some((entry) => entry.id === target.id) ?? false,
      );
      if (source.kind !== 'shield_fox' || source.hp <= 0 || target.id === source.id) continue;
      const isolated = clone(battle);
      const fox = isolated.allies.find((entry) => entry.id === source.id)!;
      fox.shield = fox.maxHp * 10;
      isolated.allies = [fox, isolated.allies.find((entry) => entry.id === target.id)!];
      expect(shieldTarget(isolated, fox)?.id === target.id).toBe(covered);
    }
  }
  expect(JSON.stringify(battle)).toBe(before);
  const model = shieldSources(battle, 40)!;
  model.sources[0].position.x = 99;
  expect(JSON.stringify(battle)).toBe(before);
});

test('整体中心超边界时移除，射程天赋扩大双向范围；来源倒下/移动/退场后重新读取更新', () => {
  const battle = setup();
  const target = battle.allies.find((unit) => unit.id === 40)!;
  target.position.y = 3;
  expect(shieldSources(battle, 40)!.sources).toEqual([]);
  battle.progression.buffs.range = 3;
  const sources = shieldSources(battle, 40)!.sources;
  expect(sources.map((source) => source.id)).toEqual([20, 30]);
  for (const source of sources) {
    expect(source.range).toBeCloseTo(3.1);
    expect(shieldCoverage(battle, source.id)!.targets.some((entry) => entry.id === 40)).toBe(true);
  }
  battle.allies.find((unit) => unit.id === 20)!.hp = 0;
  expect(shieldSources(battle, 40)!.sources.map((source) => source.id)).toEqual([30]);
  battle.allies.find((unit) => unit.id === 30)!.position = { x: 0, y: 0 };
  expect(shieldSources(battle, 40)!.sources).toEqual([]);
  battle.allies = battle.allies.filter((unit) => unit.id !== 30);
  expect(shieldSources(battle, 40)!.sources).toEqual([]);
});

test('满盾、冷却和已有准备不改可达来源；实际准备和释放仍单独统计', () => {
  const battle = setup();
  battle.spawns = [];
  for (const unit of battle.allies) unit.cooldown = 1e8;
  const target = battle.allies.find((unit) => unit.id === 40)!;
  const baseline = shieldSources(battle, 40);
  target.shield = Math.floor(
    (target.maxHp * heroes.shield_fox.skills.shieldCapPercentOfTargetMaxHp!) / 100,
  );
  target.shieldExpires = 10000;
  expect(shieldSources(battle, 40)).toEqual(baseline);
  expect(incomingShields(battle, 40)).toEqual([]);
  target.shield = 0;
  const fox = battle.allies.find((unit) => unit.id === 30)!;
  // 让真实shieldTarget在自身与其他可达伙伴都有盾时选到该目标。
  for (const unit of battle.allies.filter((unit) => unit.id !== 40)) {
    unit.shield = 1;
    unit.shieldExpires = 10000;
  }
  fox.cooldown = 0;
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: -2 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.cooldown = 1e8;
  stepCombat(battle);
  const action = battle.attacks.find((entry) => entry.team === 'ally' && entry.source === 30)!;
  expect(action.target).toBe(40);
  expect(incomingShields(battle, 40)).toHaveLength(1);
  expect(shieldSources(battle, 40)).toEqual(baseline);
  for (let i = 0; i < 20 && battle.attacks.includes(action); i++) stepCombat(battle);
  expect(target.shield).toBeGreaterThan(0);
  expect(incomingShields(battle, 40)).toEqual([]);
  expect(shieldSources(battle, 40)).toEqual(baseline);
});

test('存活无覆盖与倒下区分，缺ID/备战/null无模型，来源与目标同为0也能准确识别自身', () => {
  const battle = setup();
  expect(shieldSources(battle, 14)).toMatchObject({ targetId: 14, alive: true, sources: [] });
  battle.allies.find((unit) => unit.id === 40)!.hp = 0;
  expect(shieldSources(battle, 40)).toMatchObject({ targetId: 40, alive: false, sources: [] });
  for (const id of [999, 80, 81]) expect(shieldSources(battle, id)).toBeNull();
  expect(shieldSources(null, 0)).toBeNull();
  battle.allies = battle.allies.filter((unit) => unit.id === 0);
  expect(shieldSources(battle, 0)).toMatchObject({
    targetId: 0,
    alive: true,
    sources: [{ id: 0, rank: 2 }],
  });
});

test('SSR默认收起，来源阶数/坐标/编号和自身明示，空覆盖/倒下不提供入口，不混淆准备与已有护盾', () => {
  const battle = setup();
  const render = (id: number) =>
    renderToStaticMarkup(<ShieldSources model={shieldSources(battle, id)} onSelect={noop} />);
  const html = render(50);
  expect(html).toContain('施盾可达来源 · 2只');
  expect(html).not.toContain('open=""');
  expect(html).toContain('查看施盾可达来源：月音狐2阶，2列3行，编号0');
  expect(html).toContain('查看施盾可达来源：月音狐1阶，3列3行，编号30');
  expect(html.match(/type="button"/g)).toHaveLength(2);
  expect(html).toContain('当前射程 2.5 格');
  expect(html).toContain('不表示已准备施盾或下一次获盾');
  expect(html).toContain('不追溯已有护盾来源');
  expect(render(0)).toContain('自身施盾');
  expect(render(14)).toContain('当前没有存活月音狐的施盾范围覆盖此灵兽。');
  expect(render(14)).not.toContain('<button');
  battle.allies.find((unit) => unit.id === 50)!.hp = 0;
  expect(render(50)).toContain('此灵兽已倒下，当前不列施盾可达来源。');
  expect(render(50)).not.toContain('<button');
  expect(render(999)).toBe('');
});
