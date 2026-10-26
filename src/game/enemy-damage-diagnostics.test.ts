import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from './combat';
import { spawnEnemy } from './combat-skills';
import { bossDefinition, clone, config, enemyDefinitions } from './content';
import type { Combat } from './combat-model';
import { Session } from './session';
import { simulate } from './testing/campaign-simulation';
import { runPreparedBattle } from './testing/campaign-battle';
import {
  enemyDamageSnapshot,
  observeEnemyDamage,
  recordEnemyDamage,
} from './enemy-damage-diagnostics';

function scene(stageId = 1): Combat {
  const s = createCombat([{ id: 1, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 3 } }], {
    stageId,
  });
  s.spawns = [];
  s.allies[0].hp = s.allies[0].maxHp = 1e6;
  return s;
}

function attacker(s: Combat, kind: Parameters<typeof spawnEnemy>[1], owner?: number) {
  const e = spawnEnemy(s, kind, { x: 1.5, y: 3.5 }, owner);
  e.cooldown = 1e9;
  e.nextCleave = e.nextSummon = 1e9;
  return e;
}

describe('敌方伤害来源观测', () => {
  it('默认关闭；开启不改变战斗、随机流或序列化字段', () => {
    const off = scene();
    const e = attacker(off, 'wolf');
    off.attacks.push({ team: 'enemy', source: e.id, target: 1, due: 0, ordinal: 0 });
    const on = clone(off);
    observeEnemyDamage(on);
    stepCombat(off);
    stepCombat(on);
    expect(on).toEqual(off);
    expect(JSON.stringify(on)).toBe(JSON.stringify(off));
    expect(enemyDamageSnapshot(off)).toBeNull();
    expect(enemyDamageSnapshot(on)!.rows[0]).toMatchObject({
      kind: 'wolf',
      attack: 'basic',
      targetId: 1,
      hits: 1,
    });
  });

  it('护盾只记实际吸收；同一步过量扣血封顶，致重伤一次，死后零包不重复记', () => {
    const s = scene(5);
    s.allies[0].hp = 2;
    s.allies[0].shield = 1;
    s.allies[0].shieldExpires = 1e9;
    const first = attacker(s, 'boss');
    const second = attacker(s, 'boss');
    for (const e of [first, second])
      s.attacks.push({ team: 'enemy', source: e.id, target: 1, due: 0, ordinal: 0 });
    observeEnemyDamage(s);
    stepCombat(s);
    const report = enemyDamageSnapshot(s)!;
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      sourceId: first.id,
      hpLoss: 2,
      shieldAbsorbed: 1,
      lethal: 1,
      hits: 1,
      firstAt: 0,
      lastAt: 0,
    });
    expect(s.damageTaken).toBe(2);
    expect(s.report!.units[0].shieldAbsorbed).toBe(1);
    const shielded = scene();
    shielded.allies[0].shield = 1e6;
    shielded.allies[0].shieldExpires = 1e9;
    const wolf = attacker(shielded, 'wolf');
    shielded.attacks.push({ team: 'enemy', source: wolf.id, target: 1, due: 0, ordinal: 0 });
    observeEnemyDamage(shielded);
    stepCombat(shielded);
    expect(enemyDamageSnapshot(shielded)!.rows[0]).toMatchObject({
      hpLoss: 0,
      shieldAbsorbed: enemyDefinitions.wolf.hitDamage,
      lethal: 0,
    });
  });

  it('首领普攻/横扫/追击分开，多格跨排不重复伤害；各目标守恒', () => {
    const s = scene(50);
    const extra = createCombat([{ id: 2, kind: 'ice_fish', rank: 1, position: { x: 3, y: 2 } }])
      .allies[0];
    extra.hp = extra.maxHp = 1e6;
    extra.cooldown = 1e9;
    s.allies.push(extra);
    s.report!.units.push({
      id: 2,
      damageDone: 0,
      damageTaken: 0,
      income: 0,
      shieldGiven: 0,
      shieldAbsorbed: 0,
    });
    const boss = attacker(s, 'boss');
    s.attacks.push({ team: 'enemy', source: boss.id, target: 1, due: 0, ordinal: 0 });
    s.warnings.push(
      { source: boss.id, row: 3, due: 0 },
      { source: boss.id, row: 3, due: 0, echo: true },
    );
    observeEnemyDamage(s);
    stepCombat(s);
    const rows = enemyDamageSnapshot(s)!.rows;
    const skill = bossDefinition(50);
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.attack === 'basic')).toHaveLength(1);
    expect(rows.filter((r) => r.attack === 'cleave').map((r) => r.hpLoss)).toEqual([
      skill.cleaveHitDamage,
      skill.cleaveHitDamage,
    ]);
    const echoDamage = Math.max(
      config.damage.minHitDamage,
      Math.floor((skill.cleaveHitDamage * (skill.cleaveEchoDamagePercent ?? 100)) / 100),
    );
    expect(rows.filter((r) => r.attack === 'echo').map((r) => r.hpLoss)).toEqual([
      echoDamage,
      echoDamage,
    ]);
    for (const stat of s.report!.units)
      expect(rows.filter((r) => r.targetId === stat.id).reduce((n, r) => n + r.hpLoss, 0)).toBe(
        stat.damageTaken,
      );
  });

  it('召唤/分裂子怪归自己并保留父ID，不把伤害转给父怪', () => {
    const s = scene(8);
    const parent = attacker(s, 'summoner');
    const wolf = attacker(s, 'summoned_wolf', parent.id);
    const fragment = attacker(s, 'split_fragment', parent.id);
    for (const e of [wolf, fragment])
      s.attacks.push({ team: 'enemy', source: e.id, target: 1, due: 0, ordinal: 0 });
    observeEnemyDamage(s);
    stepCombat(s);
    const rows = enemyDamageSnapshot(s)!.rows;
    expect(rows.map((r) => [r.sourceId, r.kind, r.owner])).toEqual([
      [wolf.id, 'summoned_wolf', parent.id],
      [fragment.id, 'split_fragment', parent.id],
    ]);
  });

  it('攻击者同一步被击败，已释放普攻仍保留来源', () => {
    const s = createCombat([{ id: 1, kind: 'boar', rank: 1, position: { x: 1, y: 3 } }]);
    s.spawns = [];
    s.allies[0].cooldown = 1e9;
    const e = attacker(s, 'wolf');
    e.hp = 1;
    // Both attacks release before resolution; the first packet kills the wolf.
    s.attacks.push(
      { team: 'ally', source: 1, target: e.id, due: 0, ordinal: 1 },
      { team: 'enemy', source: e.id, target: 1, due: 0, ordinal: 0 },
    );
    observeEnemyDamage(s);
    stepCombat(s);
    expect(s.enemies).toHaveLength(0);
    expect(s.damageDone).toBe(1);
    expect(enemyDamageSnapshot(s)!.rows[0]).toMatchObject({
      sourceId: e.id,
      kind: 'wolf',
      hpLoss: s.damageTaken,
    });
    expect(s.damageTaken).toBeGreaterThan(0);
  });

  it('中途启用标部分，重复启用保留历史；未知来源不丢失且快照不能修改聚合', () => {
    const s = scene();
    s.time = 500;
    observeEnemyDamage(s);
    const p = { team: 'ally' as const, id: 1, damage: 10 };
    recordEnemyDamage(s, p, 4, 6, false);
    observeEnemyDamage(s);
    s.time = 550;
    recordEnemyDamage(s, p, 3, 0, true);
    recordEnemyDamage(s, p, 0, 0, false);
    const snapshot = enemyDamageSnapshot(s)!;
    expect(snapshot).toMatchObject({ startedAt: 500, completeFromStart: false });
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]).toMatchObject({
      sourceId: null,
      kind: 'unknown',
      attack: 'unknown',
      hpLoss: 7,
      shieldAbsorbed: 6,
      hits: 2,
      lethal: 1,
      firstAt: 500,
      lastAt: 550,
    });
    snapshot.rows[0].hpLoss = 999;
    snapshot.rows.length = 0;
    expect(enemyDamageSnapshot(s)!.rows[0].hpLoss).toBe(7);
  });

  it('真实第20关合法检查点开关结果/存档逐字段相等，逐目标与全场扣血/护盾守恒', () => {
    const campaign = simulate(20261014, 'control', false, 20);
    const save = campaign.checkpoints[19];
    const before = clone(save);
    const beforeConfig = clone(config);
    const off = Session.restore(save);
    const on = Session.restore(save);
    const baseline = runPreparedBattle(off, 'control', false);
    const observed = runPreparedBattle(on, 'control', false, false, { enemyDamage: true });
    const { enemyDamage, ...result } = observed;
    expect(result).toEqual(baseline);
    expect(on.exportSave()).toEqual(off.exportSave());
    expect(save).toEqual(before);
    expect(config).toEqual(beforeConfig);
    expect(enemyDamage!.completeFromStart).toBe(true);
    expect(enemyDamage!.rows.every((r) => r.kind !== 'unknown')).toBe(true);
    expect(enemyDamage!.rows.reduce((n, r) => n + r.hpLoss, 0)).toBe(observed.damageTaken);
    for (const stat of observed.report!.units) {
      const targetRows = enemyDamage!.rows.filter((r) => r.targetId === stat.id);
      expect(targetRows.reduce((n, r) => n + r.hpLoss, 0)).toBe(stat.damageTaken);
      expect(targetRows.reduce((n, r) => n + r.shieldAbsorbed, 0)).toBe(stat.shieldAbsorbed);
      expect(targetRows.reduce((n, r) => n + r.lethal, 0)).toBeLessThanOrEqual(1);
    }
    expect(enemyDamage!.rows.reduce((n, r) => n + r.lethal, 0)).toBe(observed.injured);
  });
});
