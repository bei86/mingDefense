import {
  center,
  clone,
  config,
  distance,
  enemyDefinitions,
  heroes,
  stages,
  type Point,
} from './content';
import type { Progression, Unit } from './model';
import { bonus, initialProgression } from './progression';
import {
  area,
  collectDeaths,
  contact,
  enemyTarget,
  heroRange,
  maxHeroHp,
  offerNextBuff,
  releaseAttack,
  shieldTarget,
  spawnEnemy,
} from './combat-skills';
import type { Combat, Packet, Spawn } from './combat-model';
import { recordUnitStat } from './battle-report';
export type { Ally, Attack, Combat, Enemy, Field, Flash } from './combat-model';
export { contact, enemyTarget, chooseCombatBuff } from './combat-skills';

export type CombatOptions = {
  stageId?: number;
  progression?: Progression;
  progressionEnabled?: boolean;
  rng?: number;
};
export function waveSpawns(stageId: number): Spawn[] {
  const stage = stages[stageId - 1];
  const spawns: Spawn[] = [];
  if (stage.bossId) spawns.push({ at: 0, x: 3.5, kind: 'boss' });
  for (const wave of stage.waves) {
    const remaining = Object.entries(wave.enemies).sort(([a], [b]) => a.localeCompare(b)) as [
      NonNullable<Spawn['kind']>,
      number,
    ][];
    let index = 0;
    while (remaining.some(([, count]) => count > 0)) {
      for (const item of remaining) {
        if (!item[1]) continue;
        spawns.push({
          at: wave.atMs + index * config.waves.spawnIntervalMs,
          x: config.waves.spawnColumns[index % config.waves.spawnColumns.length] + 0.5,
          kind: item[0],
        });
        item[1]--;
        index++;
      }
    }
  }
  return spawns.sort((a, b) => a.at - b.at);
}
export function createCombat(units: Unit[], options: CombatOptions = {}): Combat {
  const stageId = options.stageId ?? 1;
  const progression = clone(options.progression ?? initialProgression(20261014));
  const allies = units
    .filter((u): u is Unit & { position: Point } => u.position !== null)
    .map((u) => ({
      ...clone(u),
      hp: maxHeroHp(u, progression),
      maxHp: maxHeroHp(u, progression),
      cooldown: 0,
      ordinal: 0,
      shield: 0,
      shieldExpires: 0,
      incomeAt: u.kind === 'fortune_peach' ? heroes.fortune_peach.incomeIntervalMs![u.rank - 1] : 0,
    }));
  const startEnergy =
    allies.filter(
      (u) => u.kind === 'shield_fox' && u.rank >= heroes.shield_fox.skills.startEnergyFromRank!,
    ).length * heroes.shield_fox.skills.startEnergy!;
  return {
    time: 0,
    stageId,
    allies,
    enemies: [],
    attacks: [],
    released: [],
    fields: [],
    warnings: [],
    spawns: waveSpawns(stageId),
    spawnIndex: 0,
    energy: Math.min(config.energy.capacity, config.energy.initial + startEnergy),
    boosted: false,
    kills: 0,
    flashes: [],
    nextFieldId: 1,
    nextEnemyId: 1,
    result: null,
    progression,
    progressionEnabled: options.progressionEnabled ?? false,
    pendingChoices: 0,
    choices: [],
    income: 0,
    fallbackIncome: 0,
    xpEarned: 0,
    rng: options.rng ?? 1,
    damageDone: 0,
    damageTaken: 0,
    report: {
      units: allies.map((u) => ({
        id: u.id,
        damageDone: 0,
        damageTaken: 0,
        income: 0,
        shieldGiven: 0,
        shieldAbsorbed: 0,
      })),
      boostedMs: 0,
    },
  };
}
function bossPhase(s: Combat): void {
  for (const boss of s.enemies.filter((e) => e.kind === 'boss' && e.hp > 0)) {
    if (!boss.phase2 && boss.hp <= (config.boss.hp * config.boss.phase2HpPercent) / 100) {
      boss.phase2 = true;
      boss.nextSummon = s.time;
    }
    if (boss.phase2 && (boss.frozenUntil ?? 0) <= s.time && s.time >= (boss.nextSummon ?? 0)) {
      const alive = s.enemies.filter(
        (e) => e.kind === 'summoned_wolf' && e.owner === boss.id && e.hp > 0,
      ).length;
      const count = Math.min(config.boss.summonCount, config.boss.maxLivingSummons - alive);
      for (let i = 0; i < count; i++)
        spawnEnemy(s, 'summoned_wolf', { x: boss.x + (i ? 0.3 : -0.3), y: boss.y }, boss.id);
      boss.nextSummon = s.time + config.boss.summonIntervalMs;
    }
  }
}
function updateEnemies(s: Combat, dt: number): void {
  bossPhase(s);
  for (const e of s.enemies) {
    const definition = e.kind === 'boss' ? config.boss : enemyDefinitions[e.kind ?? 'wolf'];
    if ((e.frozenUntil ?? 0) > s.time) {
      for (const attack of s.attacks)
        if (attack.team === 'enemy' && attack.source === e.id) attack.due += dt;
      if (e.kind === 'boss') {
        e.nextCleave = (e.nextCleave ?? 0) + dt;
        if (e.phase2) e.nextSummon = (e.nextSummon ?? 0) + dt;
        for (const w of s.warnings) if (w.source === e.id) w.due += dt;
      }
      continue;
    }
    e.cooldown -= dt;
    if (s.time >= e.recheckAt || !s.allies.some((u) => u.id === e.target && u.hp > 0)) {
      e.target = enemyTarget(s.allies, e)?.id ?? null;
      e.recheckAt = s.time + config.targeting.targetRecheckMs;
    }
    const target = s.allies.find((u) => u.id === e.target && u.hp > 0);
    if (!target) continue;
    const p = contact(target, e);
    const d = distance(e, p);
    // A movement step can stop a fraction beyond range through floating-point rounding.
    if (d > definition.rangeCells + 1e-9) {
      const localSlow = (e.slowUntil ?? 0) > s.time ? heroes.ice_fish.skills.slowPercent! : 0;
      const slow = Math.min(config.damage.slowCapPercent, localSlow + bonus(s.progression, 'slow'));
      const movement = Math.min(
        (definition.speedCellsPerSecond * (1 - slow / 100) * dt) / 1000,
        d - definition.rangeCells,
      );
      e.x += ((p.x - e.x) / d) * movement;
      e.y += ((p.y - e.y) / d) * movement;
    } else if (e.cooldown <= 0) {
      const speed = e.phase2 ? config.boss.phase2AttackSpeedBonusPercent / 100 : 0;
      s.attacks.push({
        team: 'enemy',
        source: e.id,
        target: target.id,
        ordinal: 0,
        due:
          s.time + Math.max(dt, Math.ceil(config.targeting.enemyWindupMs / (1 + speed) / dt) * dt),
      });
      e.cooldown = Math.ceil(definition.actionIntervalMs / (1 + speed) / dt) * dt;
    }
    if (e.kind === 'boss' && s.time >= (e.nextCleave ?? 0)) {
      const front = s.allies
        .filter((u) => u.hp > 0)
        .sort((a, b) => a.position.y - b.position.y || a.id - b.id)[0];
      if (front)
        s.warnings.push({
          source: e.id,
          row: front.position.y,
          due: s.time + config.boss.cleaveWarningMs,
        });
      e.nextCleave = s.time + config.boss.cleaveIntervalMs;
    }
  }
}
function updateAllies(s: Combat, dt: number): void {
  for (const u of s.allies.filter((u) => u.hp > 0)) {
    if ((u.shieldExpires ?? 0) <= s.time) u.shield = 0;
    if (u.kind === 'fortune_peach') {
      if (s.time >= (u.incomeAt ?? 0)) {
        s.income++;
        recordUnitStat(s, u.id, 'income', 1);
        u.incomeAt = s.time + heroes.fortune_peach.incomeIntervalMs![u.rank - 1];
      }
      continue;
    }
    u.cooldown -= dt;
    if (u.cooldown > 0) continue;
    const p = center(u.kind, u.position);
    const target =
      u.kind === 'shield_fox'
        ? shieldTarget(s, u)
        : s.enemies
            .filter((e) => e.hp > 0 && distance(p, e) <= heroRange(u, s.progression))
            .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id)[0];
    if (!target) continue;
    u.ordinal++;
    const speed =
      Math.min(
        config.damage.attackSpeedBonusCapPercent,
        bonus(s.progression, 'attack_speed') +
          (s.boosted ? config.energy.attackSpeedBonusPercent : 0),
      ) / 100;
    const windup = Math.max(dt, Math.ceil(heroes[u.kind].windupMs / (1 + speed) / dt) * dt);
    s.attacks.push({
      team: 'ally',
      source: u.id,
      target: target.id,
      ordinal: u.ordinal,
      due: s.time + windup,
    });
    u.cooldown = Math.ceil(heroes[u.kind].actionIntervalMs / (1 + speed) / dt) * dt;
  }
}
function resolveHits(s: Combat): void {
  const packets: Packet[] = [];
  const due = s.attacks
    .filter((a) => a.due <= s.time)
    .sort(
      (a, b) =>
        a.due - b.due ||
        a.source - b.source ||
        a.ordinal - b.ordinal ||
        a.team.localeCompare(b.team),
    );
  s.attacks = s.attacks.filter((a) => a.due > s.time);
  for (const a of due) releaseAttack(s, a, packets);
  for (const hit of s.released.filter((h) => h.due <= s.time)) {
    const target = s.enemies.find((e) => e.id === hit.target && e.hp > 0);
    if (target) {
      area(s, target, hit.radius, hit.damage, packets, hit.source);
      s.flashes.push({
        from: hit.point,
        to: { x: target.x, y: target.y },
        at: s.time,
        team: 'ally',
        kind: hit.kind,
      });
    }
  }
  s.released = s.released.filter((h) => h.due > s.time);
  for (const field of s.fields) {
    const offsets = heroes.sword_eagle.skills.residueHitOffsetsMs!;
    while (field.hits < offsets.length && s.time >= field.born + offsets[field.hits]) {
      area(
        s,
        field,
        heroes.sword_eagle.skills.splashRadiusCells!,
        field.damage,
        packets,
        field.source,
      );
      field.hits++;
    }
  }
  s.fields = s.fields.filter((f) => f.hits < heroes.sword_eagle.skills.residueHitOffsetsMs!.length);
  for (const warning of s.warnings.filter((w) => w.due <= s.time)) {
    if (!s.enemies.some((e) => e.id === warning.source && e.hp > 0)) continue;
    for (const ally of s.allies)
      if (
        ally.hp > 0 &&
        heroes[ally.kind].shape.some(([, dy]) => ally.position.y + dy === warning.row)
      )
        packets.push({ team: 'ally', id: ally.id, damage: config.boss.cleaveHitDamage });
  }
  s.warnings = s.warnings.filter((w) => w.due > s.time);
  for (const packet of packets) {
    const target =
      packet.team === 'ally'
        ? s.allies.find((u) => u.id === packet.id)
        : s.enemies.find((e) => e.id === packet.id);
    if (!target) continue;
    const reduction =
      packet.team === 'enemy' && 'kind' in target && target.kind === 'croc'
        ? enemyDefinitions.croc.skills.damageReductionPercent! / 100
        : 0;
    let damage = Math.max(config.damage.minHitDamage, Math.floor(packet.damage * (1 - reduction)));
    if (packet.team === 'ally') {
      const ally = target as Combat['allies'][number];
      const absorb = Math.min(ally.shield ?? 0, damage);
      ally.shield = (ally.shield ?? 0) - absorb;
      damage -= absorb;
      const loss = Math.min(ally.hp, damage);
      s.damageTaken += loss;
      recordUnitStat(s, ally.id, 'damageTaken', loss);
      recordUnitStat(s, ally.id, 'shieldAbsorbed', absorb);
    } else {
      const enemy = target as Combat['enemies'][number];
      const loss = Math.min(enemy.hp, damage);
      s.damageDone += loss;
      recordUnitStat(s, packet.source, 'damageDone', loss);
      if (packet.slow) enemy.slowUntil = s.time + heroes.ice_fish.skills.slowDurationMs!;
      if (packet.freeze)
        enemy.frozenUntil =
          s.time +
          heroes.ice_fish.skills.freezeDurationMs! *
            (enemy.kind === 'boss' ? heroes.ice_fish.skills.bossFreezeMultiplierPercent! / 100 : 1);
    }
    target.hp = Math.max(0, target.hp - damage);
  }
}
export function stepCombat(s: Combat, held = false): void {
  if (s.result || s.choices.length) return;
  const dt = config.runtime.tickMs;
  const cost = (config.energy.holdCostPerSecond * dt) / 1000;
  s.boosted = held && s.energy >= cost;
  if (s.boosted) s.energy -= cost;
  if (s.boosted && s.report) s.report.boostedMs += dt;
  while (s.spawnIndex < s.spawns.length && s.spawns[s.spawnIndex].at <= s.time) {
    const spawn = s.spawns[s.spawnIndex++];
    spawnEnemy(s, spawn.kind ?? 'wolf', { x: spawn.x, y: config.waves.spawnRow + 0.5 });
  }
  updateEnemies(s, dt);
  updateAllies(s, dt);
  resolveHits(s);
  collectDeaths(s);
  bossPhase(s);
  s.time += dt;
  s.flashes = s.flashes.filter((f) => s.time - f.at < 300);
  if (!s.allies.some((u) => u.hp > 0)) s.result = 'defeat';
  else if (
    s.spawnIndex === s.spawns.length &&
    !s.enemies.length &&
    !s.attacks.length &&
    !s.released.length &&
    !s.fields.length &&
    !s.warnings.length
  )
    s.result = 'victory';
  else if (s.time >= config.runtime.stageLimitMs) s.result = 'defeat';
  if (s.progressionEnabled) offerNextBuff(s);
}
