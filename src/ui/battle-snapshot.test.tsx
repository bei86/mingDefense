import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { config } from '../game/content';
import { createCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { battleSnapshotDocument } from './battle-snapshot';
import { BattleSnapshot, BattleSnapshotContent } from './BattleSnapshot';

function setup() {
  const session = new Session();
  session.preparation.stageId = 50;
  session.preparation.units = [
    { id: 0, kind: 'shield_fox', rank: 3, position: { x: 5, y: 0 } },
    { id: 12, kind: 'scatter_bear', rank: 5, position: { x: 2, y: 2 } },
    { id: 19, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 4 } },
    { id: 20, kind: 'fortune_peach', rank: 3, position: { x: 4, y: 4 } },
    { id: 99, kind: 'ice_fish', rank: 2, position: null },
  ];
  session.battle = createCombat(session.preparation.units, { stageId: 50 });
  session.phase = 'combat';
  session.pause(true);
  return session;
}

test('暂停快照逐实例导出全阵、有效护盾与备战，编号0和同名实例不混淆且只读', () => {
  const session = setup();
  const battle = session.battle!;
  battle.time = 1250;
  battle.kills = 3;
  battle.progression.buffs = { range: 2, health: 0 };
  Object.assign(battle.allies[0], { hp: 12.2, shield: 20.2, shieldExpires: 3000 });
  Object.assign(battle.allies[1], { hp: -2, shield: 100, shieldExpires: 9000 });
  Object.assign(battle.allies[2], { shield: 88, shieldExpires: 1250 });
  const wolf = spawnEnemy(battle, 'wolf', { x: 5, y: 0 });
  wolf.id = 0;
  wolf.target = 0;
  const dead = spawnEnemy(battle, 'wolf', { x: 3, y: 0 });
  dead.hp = 0;
  dead.target = 0;
  battle.allies.reverse();
  const before = JSON.stringify(session);
  const document = battleSnapshotDocument(session, true)!;
  const text = document.text;
  expect(document.fileName).toBe('ming-defense-snapshot-stage-50-time-1250ms.md');
  expect(text).toContain(`内容版本：${config.contentVersion}`);
  expect(text).toContain('来源：开发隔离试玩');
  expect(text).toContain('游戏内时间：1.25 秒');
  expect(text).toContain('存活上阵：3 / 4');
  expect(text).toContain('击退：3');
  expect(text).toContain('| 月音狐 #0 · 3阶 | 6列1行 | 存活 | 13/');
  expect(text).toContain('| 21（剩余2秒） | 1 |');
  expect(text).toMatch(/磐拳熊 #12 · 5阶 \| 3列3行 \| 已倒下 \| 0\/\d+ \| 0 \| 0/);
  expect(text).toMatch(/灵金桃 #19 · 6阶[^\n]+\| 0 \| 0/);
  expect(text).toContain('灵金桃 #20 · 3阶');
  expect(text.indexOf('月音狐 #0 · 3阶')).toBeLessThan(text.indexOf('磐拳熊 #12 · 5阶'));
  expect(text).toContain('月音狐 #0 · 3阶 · 6列1行');
  expect(text).toContain('- 霜尾鲤 #99 · 2阶');
  expect(text).toContain('- 远瞩：2层');
  expect(text).not.toContain('生息：0层');
  expect(text).not.toContain('rng');
  expect(text).not.toContain('http');
  expect(battleSnapshotDocument(session, true)).toEqual(document);
  session.tick();
  expect(JSON.stringify(session)).toBe(before);
});

test('存活敌人沿详情顺序与缺值语义，阶段/目标丢失/局部效果和衍生来源分别记录', () => {
  const session = setup();
  const battle = session.battle!;
  battle.time = 1000;
  battle.progression.buffs.slow = 1;
  const ordinary = spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: 0 });
  const child = spawnEnemy(battle, 'summoned_wolf', { x: 2, y: 0 });
  boss.phase2 = undefined;
  boss.maxHp = undefined;
  boss.target = 12345;
  child.owner = boss.id;
  child.frozenUntil = 2300;
  child.slowUntil = 1000;
  child.vulnerabilityUntil = 1700;
  child.vulnerabilityPercent = undefined;
  ordinary.hp = 33.2;
  battle.enemies.reverse();
  const before = JSON.stringify(session);
  const text = battleSnapshotDocument(session, false)!.text;
  const enemySection = text.split('## 存活敌人')[1].split('## 横扫与回响预警')[0];
  expect(text).toContain('来源：正常游戏');
  expect(enemySection.indexOf(`镇渊妖君 #${boss.id}`)).toBeLessThan(
    enemySection.indexOf(`奔雷狼 #${ordinary.id}`),
  );
  expect(enemySection).toContain('/未记录 | 阶段未记录 | 目标已倒下或退场');
  expect(enemySection).toContain(`奔雷狼 #${ordinary.id} | 34/`);
  expect(enemySection).toContain('冻结：剩余 1.3 秒');
  expect(enemySection).toContain('易伤：倍率未记录 · 剩余 0.7 秒');
  expect(enemySection).toContain('迟滞天赋：移速 -');
  expect(enemySection).not.toContain('霜尾缓行');
  expect(enemySection).toContain(`镇渊妖君 #${boss.id}`);
  child.owner = 54321;
  expect(battleSnapshotDocument(session, false)!.text).toContain('#54321（来源已退场或未记录）');
  child.owner = boss.id;
  expect(JSON.stringify(session)).toBe(before);
});

test('冻结预警分列冻结与准备时间、回响及多格当前波及，未出队列只计真实未消费项目', () => {
  const session = setup();
  const battle = session.battle!;
  battle.time = 1000;
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: 0 });
  boss.frozenUntil = 2500;
  battle.warnings = [
    { source: boss.id, row: 3, due: 1600, echo: true },
    { source: boss.id, row: 2, due: 1500 },
  ];
  battle.spawns = [
    { kind: 'boss', at: 0, x: 1 },
    { at: 500, x: 1 },
    { kind: 'summoner', at: 9000, x: 3 },
    { at: 10000, x: 5 },
  ];
  battle.spawnIndex = 1;
  const text = battleSnapshotDocument(session, false)!.text;
  expect(text).toContain('已出队列：1 / 4；尚未出场：3');
  expect(text).toContain('- 奔雷狼：2只');
  expect(text).toContain('- 鸣咒犬：1只');
  expect(text).toContain('第3行 · 横扫 · 冻结剩余1.5秒 · 解冻后准备剩余0.5秒');
  expect(text).toContain('第4行 · 回响 · 冻结剩余1.5秒 · 解冻后准备剩余0.6秒');
  expect(text.match(/当前波及：磐拳熊 #12 · 5阶 · 3列3行/g)).toHaveLength(2);
  expect(text).toContain('不是伤害预测');
  expect(text).toContain('不能恢复进度或重演操作');
});

test('空战场、缺上限旧字段与正常零值明确区分，继续再暂停后读取新时间', () => {
  const session = setup();
  const battle = session.battle!;
  battle.allies = [];
  session.preparation.units = [];
  battle.spawns = [];
  const first = battleSnapshotDocument(session, false)!;
  expect(first.text).toContain('无上阵灵兽。');
  expect(first.text).toContain('无存活敌人。');
  expect(first.text).toContain('当前没有已记录预警。');
  expect(first.text).toContain('无尚未出场的队列项目。');
  expect(first.text).toContain('未选择天赋');
  expect(first.text).toContain('击退：0');
  const live = new Session();
  expect(live.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  expect(live.start()).toBeNull();
  live.pause(true);
  const before = battleSnapshotDocument(live, false)!;
  live.pause(false);
  live.tick();
  live.pause(true);
  const after = battleSnapshotDocument(live, false)!;
  expect(after.text).not.toBe(before.text);
  expect(after.fileName).not.toBe(before.fileName);
  expect(before.text).toContain('游戏内时间：0.00 秒');
});

test('只允许未结束且无待选天赋的暂停战斗，备战/运行/结算/null均不生成快照', () => {
  const session = setup();
  expect(battleSnapshotDocument(new Session(), false)).toBeNull();
  session.pause(false);
  expect(battleSnapshotDocument(session, false)).toBeNull();
  session.pause(true);
  session.battle!.pendingChoices = 1;
  expect(battleSnapshotDocument(session, false)).toBeNull();
  session.battle!.pendingChoices = 0;
  session.battle!.choices = ['attack'];
  expect(battleSnapshotDocument(session, false)).toBeNull();
  session.battle!.choices = [];
  for (const phase of ['prepare', 'victory', 'defeat'] as const) {
    session.phase = phase;
    expect(battleSnapshotDocument(session, false)).toBeNull();
  }
  session.phase = 'combat';
  session.battle!.result = 'victory';
  expect(battleSnapshotDocument(session, false)).toBeNull();
});

test('SSR默认收起且无导出正文，展开内容完整只读、标签关联、复制下载与手动选择独立', () => {
  const session = setup();
  const before = JSON.stringify(session);
  const closed = renderToStaticMarkup(<BattleSnapshot session={session} isolated />);
  expect(closed).toContain('导出当前战场快照');
  expect(closed).not.toContain('open=""');
  expect(closed).not.toContain('<textarea');
  const document = battleSnapshotDocument(session, true)!;
  const html = renderToStaticMarkup(<BattleSnapshotContent document={document} />);
  expect(html).toContain('复制战场快照');
  expect(html).toContain('下载战场快照');
  expect(html).toContain('选中文本');
  expect(html).toContain('readOnly=""');
  expect(html).toContain('来源：开发隔离试玩');
  expect(html).toContain('灵金桃 #19');
  expect(html).toContain('灵金桃 #20');
  expect(html).not.toContain('收藏到本地');
  const id = html.match(/<textarea[^>]+id="([^"]+)"/)![1];
  expect(html).toContain(`aria-controls="${id}"`);
  expect(html).toContain(`for="${id}">当前战场快照（可手动全选复制）`);
  expect(JSON.stringify(session)).toBe(before);
});
