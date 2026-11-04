import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import type { UnitBattleStats } from '../game/combat-model';
import { spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { battleSnapshotDocument } from './battle-snapshot';
import { BattleSnapshotContent } from './BattleSnapshot';
import { reportMetrics } from './report-unit-sort';

function setup() {
  const session = new Session();
  session.preparation.stageId = 50;
  session.preparation.units = [
    { id: 0, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
    { id: 1, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } },
    { id: 2, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 0 } },
    { id: 9, kind: 'ember_mouse', rank: 6, position: null },
  ];
  const battle = createCombat(session.preparation.units, { stageId: 50 });
  battle.spawns = [];
  session.battle = battle;
  session.phase = 'combat';
  session.pause(true);
  return { session, battle };
}

function section(session: Session): string {
  return (
    battleSnapshotDocument(session, true)!
      .text.split('## 本关累计贡献\n')[1]
      ?.split('## 灵兽当前行动\n')[0] ?? ''
  );
}

test('真实攻击/承伤/施盾吸收/产钱映射到逐兽贡献，不从当前生命或盾倒算', () => {
  const { session, battle } = setup();
  for (const ally of battle.allies) ally.hp = ally.maxHp = 1e6;
  battle.allies[1].cooldown = 1e8;
  const enemy = spawnEnemy(battle, 'wolf', { x: 0.5, y: 0.5 });
  enemy.hp = enemy.maxHp = 1e9;
  enemy.target = 0;
  enemy.recheckAt = 1e8;
  for (let i = 0; i < 10; i++) stepCombat(battle);
  expect(battle.report!.units[0].damageDone).toBeGreaterThan(0);
  expect(battle.report!.units[0].damageTaken).toBeGreaterThan(0);
  battle.attacks.push({ team: 'ally', source: 1, target: 0, ordinal: 1, due: battle.time });
  for (let i = 0; i < 40; i++) stepCombat(battle);
  expect(battle.report!.units[1].shieldGiven).toBeGreaterThan(0);
  expect(battle.report!.units[0].shieldAbsorbed).toBeGreaterThan(0);
  battle.time = battle.allies[2].incomeAt!;
  stepCombat(battle);
  expect(battle.report!.units[2].income).toBe(1);
  const text = section(session);
  const stats = battle.report!.units[0];
  expect(text).toContain(
    `| 烬灵鼠 #0 · 3阶 | 存活 | ${Math.floor(stats.damageDone)} | ${Math.floor(stats.damageTaken)} | 0 | ${Math.floor(stats.shieldAbsorbed)} | 0 |`,
  );
  expect(text).toContain('| 灵金桃 #2 · 1阶 | 存活 | 0 | 0 | 0 | 0 | 1 |');
  expect(text).toContain('承伤不含护盾吸收');
  expect(text).toContain('产钱仅计逐兽记录，不代表本关总收入');
});

test('倒下来源和同名编号0仍保留贡献，按站位排，备战与无关报告行不混入合计', () => {
  const { session, battle } = setup();
  battle.allies[1].kind = 'ember_mouse';
  battle.allies[0].hp = 0;
  battle.report!.units[0].damageDone = 12;
  battle.report!.units[1].damageDone = 7;
  battle.report!.units.push({
    id: 9,
    damageDone: 999,
    damageTaken: 999,
    shieldGiven: 999,
    shieldAbsorbed: 999,
    income: 999,
  });
  battle.allies.reverse();
  battle.report!.units.reverse();
  const before = JSON.stringify(session);
  const document = battleSnapshotDocument(session, true)!;
  const text = section(session);
  expect(text).toContain('| 烬灵鼠 #0 · 3阶 | 已倒下 | 12 |');
  expect(text).toContain('| 烬灵鼠 #1 · 3阶 | 存活 | 7 |');
  expect(text.indexOf('烬灵鼠 #0')).toBeLessThan(text.indexOf('烬灵鼠 #1'));
  expect(text).toContain('- 伤害合计：19');
  expect(text).not.toContain('#9');
  expect(text).not.toContain('999');
  expect(battleSnapshotDocument(session, true)).toEqual(document);
  expect(JSON.stringify(session)).toBe(before);
});

test('缺字段/整行、非有限和负值明确未记录，完整指标独立保留且不拿战斗总数补齐', () => {
  const { session, battle } = setup();
  const missing = battle.report!.units[0] as Partial<UnitBattleStats>;
  delete missing.shieldGiven;
  missing.damageDone = Number.NaN;
  missing.damageTaken = -1;
  missing.shieldAbsorbed = Number.POSITIVE_INFINITY;
  battle.report!.units = battle.report!.units.filter((entry) => entry.id !== 2);
  battle.damageDone = 999999;
  const text = section(session);
  expect(text).toContain('| 烬灵鼠 #0 · 3阶 | 存活 | 未记录 | 未记录 | 未记录 | 未记录 | 0 |');
  expect(text).toContain('| 灵金桃 #2 · 1阶 | 存活 | 未记录 | 未记录 | 未记录 | 未记录 | 未记录 |');
  for (const label of ['伤害', '承伤', '提供护盾', '护盾吸收'])
    expect(text).toContain(`- ${label}合计：未记录（缺2只记录）`);
  expect(text).toContain('- 产钱合计：未记录（缺1只记录）');
  expect(text).not.toMatch(/NaN|Infinity|999999/);
  battle.report!.units.push({
    id: 2,
    damageDone: 0,
    damageTaken: 0,
    shieldGiven: 0,
    shieldAbsorbed: 0,
    income: 2,
  });
  expect(section(session)).toContain('- 产钱合计：2');
});

test('真实0、空阵线与无报告区分，不把缺失记录显示成0', () => {
  const { session, battle } = setup();
  expect(section(session)).toContain('| 烬灵鼠 #0 · 3阶 | 存活 | 0 | 0 | 0 | 0 | 0 |');
  for (const { label } of reportMetrics) expect(section(session)).toContain(`- ${label}合计：0`);
  delete battle.report;
  expect(section(session)).toContain('未记录（无逐兽记录）');
  expect(section(session)).not.toContain('合计：0');
  battle.allies = [];
  expect(section(session)).toContain('无上阵灵兽贡献。');
  battle.report = { units: [], boostedMs: 0 };
  expect(section(session)).toContain('- 伤害合计：0');
});

test('合计先求原始和再向下取整，不能把逐行取整相加冒充原始总量，SSR说明当前累计', () => {
  const { session, battle } = setup();
  for (const { key } of reportMetrics) {
    battle.report!.units[0][key] = 0.8;
    battle.report!.units[1][key] = 0.8;
  }
  const document = battleSnapshotDocument(session, true)!;
  const text = section(session);
  expect(text).toContain('| 烬灵鼠 #0 · 3阶 | 存活 | 0 | 0 | 0 | 0 | 0 |');
  expect(text).toContain('| 月音狐 #1 · 3阶 | 存活 | 0 | 0 | 0 | 0 | 0 |');
  for (const { label } of reportMetrics) expect(text).toContain(`- ${label}合计：1`);
  expect(text).toContain('合计按原始记录求和后向下取整');
  const html = renderToStaticMarkup(<BattleSnapshotContent document={document} />);
  expect(html).toContain('本关累计贡献与合计');
  expect(html).toContain('继续守卫后会变化');
});
