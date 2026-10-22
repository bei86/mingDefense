import { describe, expect, it } from 'vitest';
import { bossDefinition, config, enemyDefinitions, stages } from '../game/content';
import { createCombat, waveSpawns } from '../game/combat';
import { releaseAttack, spawnEnemy } from '../game/combat-skills';
import type { Packet } from '../game/combat-model';
import { stageIntel } from './stage-intel';

describe('关卡敌情手册', () => {
  it.each(stages.map((stage) => stage.id))('第%i关与真实排程及出生属性一致', (stageId) => {
    const intel = stageIntel(stageId);
    const spawns = waveSpawns(stageId);
    expect(intel.total).toBe(spawns.length);
    expect(intel.lastSpawnAt).toBe(spawns.at(-1)!.at);
    expect(intel.enemies.reduce((n, enemy) => n + enemy.count, 0)).toBe(intel.total);
    const combat = createCombat(
      [{ id: 1, kind: 'ember_mouse', rank: 1, position: { x: 2, y: 3 } }],
      { stageId },
    );
    for (const entry of [...intel.enemies, ...intel.derived]) {
      const enemy = spawnEnemy(combat, entry.kind, { x: 0, y: 0 });
      expect(entry.hp).toBe(enemy.hp);
      const definition =
        entry.kind === 'boss' ? bossDefinition(stageId) : enemyDefinitions[entry.kind];
      const packets: Packet[] = [];
      releaseAttack(
        combat,
        { due: 0, source: enemy.id, target: 1, team: 'enemy', ordinal: 0 },
        packets,
      );
      expect(packets).toHaveLength(1);
      expect(entry.damage).toBe(packets[0].damage);
      expect(entry.intervalMs).toBe(definition.actionIntervalMs);
      expect(entry.xp).toBe(definition.xp);
      expect(entry.energy).toBe(
        entry.kind === 'boss'
          ? config.energy.bossKillGain
          : (enemyDefinitions[entry.kind].energyGain ?? config.energy.perKill),
      );
      const times = spawns
        .filter((spawn) => (spawn.kind ?? 'wolf') === entry.kind)
        .map((spawn) => spawn.at);
      expect(entry.count).toBe(times.length);
      expect(entry.firstAt).toBe(times[0]);
      expect(entry.lastAt).toBe(times.at(-1));
    }
  });

  it('狼狂暴只从第6关启用', () => {
    expect(
      stageIntel(1)
        .enemies.find((e) => e.kind === 'wolf')!
        .skills.join(),
    ).toContain('尚未启用');
    expect(
      stageIntel(6)
        .enemies.find((e) => e.kind === 'wolf')!
        .skills.join(),
    ).toContain('最多6层');
  });

  it('召唤和分裂另列，不能伪装成固定出场总数', () => {
    expect(stageIntel(1).derived).toEqual([]);
    const intel = stageIntel(50);
    expect(intel.derived.map((e) => e.kind)).toEqual(['summoned_wolf']);
    const mixedStage = stages.find(
      (stage) =>
        stage.waves.some((wave) => wave.enemies.summoner) &&
        stage.waves.some((wave) => wave.enemies.splitter),
    )!;
    expect(stageIntel(mixedStage.id).derived.map((e) => e.kind)).toEqual([
      'summoned_wolf',
      'split_fragment',
    ]);
    expect(intel.derived.every((e) => e.count === 0 && e.firstAt === undefined)).toBe(true);
    const shadow = intel.derived.find((e) => e.kind === 'summoned_wolf')!;
    expect(shadow.xp).toBe(0);
    expect(shadow.energy).toBe(0);
    const boss = intel.enemies.find((e) => e.kind === 'boss')!;
    expect(boss.hp).toBe(bossDefinition(50).hp);
    expect(boss.skills.join()).toContain('双段横扫');
    expect(boss.skills.join()).toContain(String(bossDefinition(50).cleaveHitDamage));
  });

  it.each([0, -1, 51, 1.5, NaN])('拒绝非法关卡 %s', (id) => {
    expect(() => stageIntel(id)).toThrow(RangeError);
  });
});
