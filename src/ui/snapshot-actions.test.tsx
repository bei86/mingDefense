import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { config } from '../game/content';
import { Session } from '../game/session';
import { battleSnapshotDocument } from './battle-snapshot';
import { BattleSnapshotContent } from './BattleSnapshot';

function setup() {
  const session = new Session();
  session.preparation.stageId = 50;
  session.preparation.units = [
    { id: 0, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
    { id: 1, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } },
    { id: 2, kind: 'fortune_peach', rank: 1, position: { x: 3, y: 0 } },
  ];
  const b = createCombat(session.preparation.units, { stageId: 50 });
  b.spawns = [];
  session.battle = b;
  session.phase = 'combat';
  session.pause(true);
  const e = spawnEnemy(b, 'wolf', { x: 0.5, y: 0.5 });
  e.id = 0;
  e.hp = e.maxHp = 1e8;
  e.target = 0;
  e.recheckAt = 1e8;
  for (const ally of b.allies) ally.hp = ally.maxHp = 1e6;
  return { session, b, e };
}

function actions(session: Session, heading: string, next: string): string {
  return (
    battleSnapshotDocument(session, true)!
      .text.split(`## ${heading}\n`)[1]
      ?.split(`## ${next}\n`)[0] ?? ''
  );
}

test('真实双方准备、待释放与释放后的快照分离冷却和命中，双方编号0不混淆', () => {
  const { session, b, e } = setup();
  stepCombat(b);
  const attack = b.attacks.find((a) => a.team === 'ally' && a.source === 0)!;
  expect(actions(session, '灵兽当前行动', '存活敌人')).toContain('准备攻击 #1 → 敌方 奔雷狼 · #0');
  e.target = 2;
  const enemyText = actions(session, '敌人当前普攻', '横扫与回响预警');
  expect(enemyText).toContain('准备普攻 → 己方 烬灵鼠 #0 · 3阶 · 1列1行');
  expect(enemyText).not.toContain('准备普攻 → 己方 灵金桃');
  while (b.time < attack.due) stepCombat(b);
  expect(actions(session, '灵兽当前行动', '存活敌人')).toContain('待释放');
  stepCombat(b);
  expect(b.damageDone).toBeGreaterThan(0);
  expect(actions(session, '灵兽当前行动', '存活敌人')).not.toContain('准备攻击 #1');
  expect(actions(session, '灵兽当前行动', '存活敌人')).toContain('再次行动最早');
});

test('施盾明确己方目标，桃独立产钱到期；实际释放增加护盾、实际产钱更新倒计时', () => {
  const { session, b, e } = setup();
  e.cooldown = 1e8;
  b.allies[0].cooldown = b.allies[1].cooldown = 1e8;
  b.attacks.push({ team: 'ally', source: 1, target: 0, ordinal: 7, due: 0 });
  expect(actions(session, '灵兽当前行动', '存活敌人')).toContain(
    '准备施盾 #7 → 己方 烬灵鼠3阶 · #0 · 待释放',
  );
  stepCombat(b);
  expect(b.allies[0].shield).toBeGreaterThan(0);
  expect(actions(session, '灵兽当前行动', '存活敌人')).not.toContain('准备施盾 #7');
  b.time = b.allies[2].incomeAt!;
  let text = actions(session, '灵兽当前行动', '存活敌人');
  expect(text).toContain('下次产钱：待产钱');
  expect(text.split('- 灵金桃')[1]).not.toContain('再次行动最早');
  stepCombat(b);
  expect(b.report!.units.find((u) => u.id === 2)!.income).toBe(1);
  text = actions(session, '灵兽当前行动', '存活敌人');
  expect(text).toMatch(/下次产钱：剩余[\d.]+秒/);
});

test('冻结普攻分列冻结及解冻后准备，真实冻结步保持冷却和准备，0准备不误称待释放', () => {
  const { session, b, e } = setup();
  b.allies.forEach((u) => {
    u.cooldown = 1e8;
  });
  stepCombat(b);
  e.frozenUntil = b.time + 3 * config.runtime.tickMs;
  const first = actions(session, '敌人当前普攻', '横扫与回响预警');
  expect(first).toContain('解冻后再次普攻最早');
  expect(first).toMatch(/冻结剩余0.2秒/);
  const timing = first.match(/解冻后准备剩余[\d.]+秒/)![0];
  stepCombat(b);
  expect(actions(session, '敌人当前普攻', '横扫与回响预警')).toContain(timing);
  b.attacks.find((a) => a.team === 'enemy')!.due = b.time;
  const zero = actions(session, '敌人当前普攻', '横扫与回响预警');
  expect(zero).toContain('解冻后准备剩余0秒（待解冻）');
  expect(zero).not.toContain('待释放');
});

test('多个准备稳定排序，失效目标保留名称/编号，倒下来源旧动作不列，输出只读', () => {
  const { session, b, e } = setup();
  b.time = 100;
  e.hp = 0;
  const boss = spawnEnemy(b, 'boss', { x: 1, y: 0 });
  b.attacks = [
    { team: 'ally', source: 0, target: 0, ordinal: 3, due: 500 },
    { team: 'ally', source: 0, target: 999, ordinal: 2, due: 100 },
    { team: 'ally', source: 0, target: 998, ordinal: 1, due: 100 },
    { team: 'ally', source: 1, target: 0, ordinal: 99, due: 100 },
    { team: 'enemy', source: boss.id, target: 1, ordinal: 0, due: 100 },
    { team: 'enemy', source: boss.id, target: 999, ordinal: 0, due: 500 },
  ];
  b.allies[1].hp = 0;
  b.allies.reverse();
  const before = JSON.stringify(session);
  const text = battleSnapshotDocument(session, true)!.text;
  const allyText = actions(session, '灵兽当前行动', '存活敌人');
  expect(allyText.indexOf('准备攻击 #1')).toBeLessThan(allyText.indexOf('准备攻击 #2'));
  expect(allyText.indexOf('准备攻击 #2')).toBeLessThan(allyText.indexOf('准备攻击 #3'));
  expect(allyText).toContain('敌方 奔雷狼 · #0');
  expect(allyText).toContain('敌方 #998');
  expect(allyText).toContain('目标已倒下或退场，此动作不会生效');
  expect(allyText).toContain('已倒下，本关不再行动');
  expect(allyText).not.toContain('准备施盾 #99');
  const enemyText = actions(session, '敌人当前普攻', '横扫与回响预警');
  expect(enemyText).toContain('己方 月音狐 #1 · 3阶 · 2列1行');
  expect(enemyText).toContain('己方 #999');
  expect(enemyText).toContain('目标已倒下或未记录，此次普攻不会生效');
  expect(battleSnapshotDocument(session, true)!.text).toBe(text);
  expect(JSON.stringify(session)).toBe(before);
});

test('空阵营有行动空态；导出介绍含当前准备，完整已发出攻击仍明确不包含', () => {
  const { session, b } = setup();
  b.allies = [];
  b.enemies = [];
  const document = battleSnapshotDocument(session, true)!;
  expect(document.text).toContain('无上阵灵兽行动。');
  expect(document.text).toContain('无存活敌人普攻。');
  expect(document.text).toContain('包含当前准备队列，不包含完整已发出攻击与持续效果');
  const html = renderToStaticMarkup(<BattleSnapshotContent document={document} />);
  expect(html).toContain('双方当前行动与准备');
});
