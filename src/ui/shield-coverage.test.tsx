import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { shieldTarget, spawnEnemy } from '../game/combat-skills';
import { clone, heroes } from '../game/content';
import { battleStats } from './battle-stats';
import { incomingShields } from './incoming-shields';
import { shieldCoverage } from './shield-coverage';
import { ShieldCoverage } from './ShieldCoverage';

const noop = () => {};
function setup() {
  const battle = createCombat([
    { id: 30, kind: 'shield_fox', rank: 1, position: { x: 2, y: 2 } },
    { id: 12, kind: 'ember_mouse', rank: 4, position: { x: 1, y: 2 } },
    { id: 8, kind: 'ember_mouse', rank: 4, position: { x: 5, y: 2 } },
    { id: 0, kind: 'boar', rank: 4, position: { x: 4, y: 2 } },
    { id: 9, kind: 'boar', rank: 4, position: { x: 4, y: 3 } },
    { id: 50, kind: 'fortune_peach', rank: 6, position: { x: 2, y: 1 } },
    { id: 40, kind: 'shield_fox', rank: 3, position: { x: 3, y: 2 } },
    { id: 70, kind: 'scatter_bear', rank: 4, position: { x: 0, y: 0 } },
    { id: 60, kind: 'sword_eagle', rank: 4, position: { x: 2, y: 3 } },
    { id: 80, kind: 'shield_fox', rank: 3, position: null },
  ]);
  battle.allies.find((unit) => unit.id === 60)!.hp = 0;
  return battle;
}

test('低阶狐施盾可达包含自身、桃和其他狐，精确多格中心边界与真实shieldTarget逐只一致；快照不共享', () => {
  const battle = setup();
  const before = JSON.stringify(battle);
  const model = shieldCoverage(battle, 30)!;
  expect(model).toMatchObject({ sourceId: 30, alive: true, range: 2.5 });
  expect(model.targets.map((unit) => unit.id)).toEqual([70, 50, 12, 30, 40, 0]);
  // 岩甲豚整体中心距2.5恰好在边界，下一行的同种整体中心已超出。
  expect(model.targets.find((unit) => unit.id === 0)).toMatchObject({ position: { x: 4, y: 2 } });
  for (const target of battle.allies.filter((unit) => unit.id !== 30)) {
    const isolated = clone(battle);
    const source = isolated.allies.find((unit) => unit.id === 30)!;
    source.shield = source.maxHp * 10;
    const candidate = isolated.allies.find((unit) => unit.id === target.id)!;
    isolated.allies = [source, candidate];
    expect(shieldTarget(isolated, source)?.id === target.id).toBe(
      model.targets.some((unit) => unit.id === target.id),
    );
  }
  expect(JSON.stringify(battle)).toBe(before);
  model.targets[0].position.x = 99;
  expect(JSON.stringify(battle)).toBe(before);
});

test('射程天赋扩大施盾名单而非光环，已有满盾仍可达，倒下和备战不混入；重新读取反映变化', () => {
  const battle = setup();
  battle.allies[0].rank = 3;
  const aura = battleStats(battle, 30)!.auraTargets;
  battle.progression.buffs.range = 3;
  const expanded = shieldCoverage(battle, 30)!;
  expect(expanded.range).toBeCloseTo(3.1);
  expect(expanded.targets.map((unit) => unit.id)).toEqual([70, 50, 12, 30, 40, 0, 8, 9]);
  expect(battleStats(battle, 30)!.auraTargets).toEqual(aura);
  const target = battle.allies.find((unit) => unit.id === 0)!;
  target.shield = Math.floor(
    (target.maxHp * heroes.shield_fox.skills.shieldCapPercentOfTargetMaxHp!) / 100,
  );
  target.shieldExpires = 10000;
  expect(shieldCoverage(battle, 30)!.targets.some((unit) => unit.id === 0)).toBe(true);
  target.hp = 0;
  expect(shieldCoverage(battle, 30)!.targets.some((unit) => unit.id === 0)).toBe(false);
  battle.allies.find((unit) => unit.id === 8)!.position.x = 6;
  expect(shieldCoverage(battle, 30)!.targets.some((unit) => unit.id === 8)).toBe(false);
  expect(shieldCoverage(battle, 30)!.targets.some((unit) => unit.id === 80)).toBe(false);
});

test('来源倒下不留名单，空战斗、退场、非狐和备战不生成入口；来源编号0可自施盾', () => {
  const battle = setup();
  expect(shieldCoverage(null, 30)).toBeNull();
  for (const id of [999, 80, 12, 50]) expect(shieldCoverage(battle, id)).toBeNull();
  battle.allies[0].hp = 0;
  expect(shieldCoverage(battle, 30)).toMatchObject({ alive: false, targets: [] });
  battle.allies[0].hp = 1;
  battle.allies[0].id = 0;
  battle.allies = [battle.allies[0]];
  expect(shieldCoverage(battle, 0)).toMatchObject({
    sourceId: 0,
    alive: true,
    targets: [{ id: 0 }],
  });
});

test('真实stepCombat的准备目标属于可达名单，准备记录与范围分开，读取不改Combat/RNG，释放沿原规则', () => {
  const battle = setup();
  battle.spawns = [];
  for (const unit of battle.allies) unit.cooldown = 1e8;
  const source = battle.allies[0];
  source.cooldown = 0;
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: -2 });
  enemy.hp = enemy.maxHp = 1e8;
  enemy.cooldown = 1e8;
  const model = shieldCoverage(battle, 30)!;
  expect(model.targets.length).toBeGreaterThan(1);
  expect(model.targets.every((target) => incomingShields(battle, target.id).length === 0)).toBe(
    true,
  );
  stepCombat(battle);
  const action = battle.attacks.find(
    (entry) => entry.source === source.id && entry.team === 'ally',
  )!;
  expect(action).toBeDefined();
  expect(model.targets.some((unit) => unit.id === action.target)).toBe(true);
  expect(incomingShields(battle, action.target)).toHaveLength(1);
  const before = JSON.stringify(battle);
  shieldCoverage(battle, 30);
  expect(JSON.stringify(battle)).toBe(before);
  for (let i = 0; i < 20 && battle.attacks.includes(action); i++) stepCombat(battle);
  expect(battle.allies.find((unit) => unit.id === action.target)!.shield).toBeGreaterThan(0);
});

test('SSR默认收起，名称/阶数/坐标/编号区分实例，自身明示，说明范围不承诺下次施盾；死亡和非狐安全', () => {
  const battle = setup();
  const render = (id = 30) =>
    renderToStaticMarkup(<ShieldCoverage model={shieldCoverage(battle, id)} onSelect={noop} />);
  const html = render();
  expect(html).toContain('施盾可达灵兽 · 6只');
  expect(html).not.toContain('open=""');
  expect(html).toContain('本狐自身');
  expect(html).toContain('当前施盾射程 2.5 格');
  expect(html).toContain('可达不保证下一次获盾');
  expect(html).toContain('不代表攻击光环覆盖或已准备的施盾动作');
  expect(html).toContain('查看施盾可达灵兽：岩甲豚4阶，5列3行，编号0');
  expect(html).toContain('查看施盾可达灵兽：月音狐3阶，4列3行，编号40');
  expect(html.match(/type="button"/g)).toHaveLength(6);
  battle.allies[0].hp = 0;
  expect(render()).toContain('此狐已倒下，本关不再施盾。');
  expect(render()).not.toContain('<button');
  expect(render(12)).toBe('');
  expect(render(999)).toBe('');
});
