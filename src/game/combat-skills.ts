import {
  cells,
  bossDefinition,
  center,
  config,
  distance,
  enemyDefinitions,
  heroes,
  stages,
  tauntValue,
  type EnemyKind,
  type Point,
} from './content';
import type { BuffId, Progression, Unit } from './model';
import { bonus, buffDefinitions, drawBuffs, gainExperience } from './progression';
import type { Ally, Attack, Combat, Enemy, Packet } from './combat-model';
import { recordUnitStat } from './battle-report';
import { releaseBearAttack, releaseMonkeyAttack } from './combat-projectiles';
import { random } from './random';
import { recordEnemyBirth, recordEnemyDeath } from './combat-diagnostics';

export function maxHeroHp(u: Unit, p: Progression): number {
  return Math.floor((heroes[u.kind].hp[u.rank - 1] * (100 + bonus(p, 'health'))) / 100);
}
export function heroRange(u: Unit, p: Progression): number {
  return heroes[u.kind].rangeCells + bonus(p, 'range');
}
export function contact(ally: Ally, enemy: Point): Point {
  return cells(ally.kind, ally.position)
    .map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))
    .sort((a, b) => distance(a, enemy) - distance(b, enemy) || a.y - b.y || a.x - b.x)[0];
}
export function enemyTarget(allies: Ally[], e: Point): Ally | undefined {
  const alive = allies.filter((u) => u.hp > 0);
  const frontRow = Math.min(...alive.map((u) => u.position.y));
  return alive
    .filter((u) => u.position.y === frontRow)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        tauntValue(b.kind) - tauntValue(a.kind) ||
        distance(contact(a, e), e) - distance(contact(b, e), e) ||
        a.id - b.id,
    )[0];
}
export function shieldTarget(s: Combat, source: Ally): Ally | undefined {
  const p = center(source.kind, source.position);
  return s.allies
    .filter(
      (u) =>
        u.hp > 0 && distance(p, center(u.kind, u.position)) <= heroRange(source, s.progression),
    )
    .sort((a, b) => (a.shield ?? 0) / a.maxHp - (b.shield ?? 0) / b.maxHp || a.id - b.id)[0];
}
export function attackDamage(s: Combat, source: Ally): number {
  let additive = bonus(s.progression, 'attack');
  if (source.kind === 'boar') additive += bonus(s.progression, 'boar_attack');
  if (source.kind === 'scatter_bear') additive += bonus(s.progression, 'bear_attack');
  const p = center(source.kind, source.position);
  if (
    s.allies.some(
      (u) =>
        u.hp > 0 &&
        u.kind === 'shield_fox' &&
        u.rank >= heroes.shield_fox.skills.auraFromRank! &&
        distance(center(u.kind, u.position), p) <= heroes.shield_fox.skills.auraRadiusCells!,
    )
  )
    additive += heroes.shield_fox.skills.auraAttackPercent!;
  return (heroes[source.kind].hitDamage[source.rank - 1] * (100 + additive)) / 100;
}
export function area(
  s: Combat,
  point: Point,
  radius: number,
  damage: number,
  packets: Packet[],
  source?: number,
): void {
  for (const e of s.enemies)
    if (e.hp > 0 && distance(e, point) <= radius)
      packets.push({ team: 'enemy', id: e.id, damage, source });
}
export function spawnEnemy(s: Combat, kind: EnemyKind, point: Point, owner?: number): Enemy {
  const boss = kind === 'boss';
  const definition = boss ? bossDefinition(s.stageId) : enemyDefinitions[kind];
  const stage = stages[s.stageId - 1];
  const hp = Math.round(definition.hp * (boss ? 1 : stage.hpMultiplier));
  const enemy: Enemy = {
    ...point,
    id: s.nextEnemyId++,
    kind,
    hp,
    maxHp: hp,
    cooldown: 0,
    target: null,
    recheckAt: 0,
    owner,
    born: s.time,
  };
  if (boss) {
    const skill = bossDefinition(s.stageId);
    enemy.nextCleave = s.time + skill.cleaveIntervalMs;
    enemy.nextSummon = skill.summonFromStart ? s.time + skill.summonIntervalMs : 0;
    enemy.phase2 = false;
  }
  if (kind === 'summoner') {
    const skill: { firstSummonDelayMs?: number; summonEveryMs?: number } =
      enemyDefinitions.summoner.skills;
    enemy.nextSummon = s.time + (skill.firstSummonDelayMs ?? skill.summonEveryMs!);
  }
  s.enemies.push(enemy);
  recordEnemyBirth(s, enemy);
  return enemy;
}
export function releaseAttack(s: Combat, a: Attack, packets: Packet[]): void {
  if (a.team === 'enemy') {
    const source = s.enemies.find((e) => e.id === a.source && e.hp > 0);
    const target = s.allies.find((u) => u.id === a.target && u.hp > 0);
    if (!source || !target) return;
    let damage =
      source.kind === 'boss'
        ? bossDefinition(s.stageId).hitDamage
        : Math.round(
            enemyDefinitions[source.kind ?? 'wolf'].hitDamage *
              stages[s.stageId - 1].attackMultiplier,
          );
    if (source.kind === 'wolf' && s.stageId >= enemyDefinitions.wolf.skills.rageEnabledFromStage!) {
      const skill = enemyDefinitions.wolf.skills;
      const stacks = Math.min(
        skill.rageMaxStacks!,
        Math.floor((s.time - (source.born ?? 0)) / skill.rageEveryMs!),
      );
      damage = Math.floor(damage * (1 + (stacks * skill.rageAttackPercent!) / 100));
    }
    packets.push({ team: 'ally', id: target.id, damage });
    s.flashes.push({
      from: { x: source.x, y: source.y },
      to: center(target.kind, target.position),
      at: s.time,
      team: 'enemy',
    });
    return;
  }
  const source = s.allies.find((u) => u.id === a.source && u.hp > 0);
  if (!source) return;
  if (source.kind === 'shield_fox') {
    const target = s.allies.find((u) => u.id === a.target && u.hp > 0);
    if (!target) return;
    const skill = heroes.shield_fox.skills;
    const amount = Math.floor(
      ((target.maxHp * skill.shieldPercentOfTargetMaxHp!) / 100) *
        (1 + bonus(s.progression, 'fox_shield') / 100),
    );
    const previousShield = target.shield ?? 0;
    target.shield = Math.min(
      Math.floor((target.maxHp * skill.shieldCapPercentOfTargetMaxHp!) / 100),
      (target.shield ?? 0) + amount,
    );
    recordUnitStat(s, source.id, 'shieldGiven', target.shield - previousShield);
    target.shieldExpires = s.time + skill.shieldDurationMs!;
    s.flashes.push({
      from: center(source.kind, source.position),
      to: center(target.kind, target.position),
      at: s.time,
      team: 'ally',
      kind: source.kind,
    });
    return;
  }
  const target = s.enemies.find((e) => e.id === a.target && e.hp > 0);
  if (!target) return;
  let damage = attackDamage(s, source);
  const point = { x: target.x, y: target.y };
  if (source.kind === 'piercing_monkey') {
    releaseMonkeyAttack(s, source, target, damage, packets);
    return;
  }
  if (source.kind === 'scatter_bear') {
    releaseBearAttack(s, source, target, damage, packets);
    return;
  }
  s.flashes.push({
    from: center(source.kind, source.position),
    to: point,
    at: s.time,
    team: 'ally',
    kind: source.kind,
  });
  if (source.kind === 'sword_eagle') {
    const skill = heroes.sword_eagle.skills;
    area(s, point, skill.splashRadiusCells!, damage, packets, source.id);
    if (source.rank >= skill.residueFromRank!)
      s.fields.push({
        ...point,
        id: s.nextFieldId++,
        source: source.id,
        born: s.time,
        damage:
          ((damage * skill.residueDamagePercent!) / 100) *
          (1 + bonus(s.progression, 'eagle_residue') / 100),
        hits: 0,
      });
    if (source.rank >= skill.doubleMainHitFromRank!)
      s.released.push({
        shape: 'area',
        due: s.time + skill.doubleMainHitOffsetMs!,
        target: target.id,
        point,
        damage,
        radius: skill.splashRadiusCells!,
        kind: source.kind,
        source: source.id,
      });
  } else if (source.kind === 'boar') {
    const skill = heroes.boar.skills;
    const every =
      source.rank >= 5 ? skill.criticalEveryAttacksFromRank5! : skill.criticalEveryAttacks!;
    if (source.rank >= skill.criticalFromRank! && a.ordinal % every === 0) {
      packets.push({
        team: 'enemy',
        id: target.id,
        damage: (damage * skill.criticalDamagePercent!) / 100,
        source: source.id,
      });
      area(
        s,
        point,
        skill.splashRadiusCells!,
        (damage * skill.splashDamageNumerator!) / skill.splashDamageDenominator!,
        packets,
        source.id,
      );
    } else packets.push({ team: 'enemy', id: target.id, damage, source: source.id });
  } else if (source.kind === 'ice_fish') {
    packets.push({
      team: 'enemy',
      id: target.id,
      damage,
      slow: true,
      source: source.id,
      freeze:
        source.rank >= heroes.ice_fish.skills.freezeFromRank! &&
        a.ordinal % heroes.ice_fish.skills.freezeEveryAttacks! === 0,
    });
  } else {
    if (
      target.hp <
        ((target.maxHp ?? enemyDefinitions[target.kind ?? 'wolf'].hp) *
          buffDefinitions.mouse_finisher.thresholdHpPercent!) /
          100 &&
      source.kind === 'ember_mouse'
    )
      damage *= 1 + bonus(s.progression, 'mouse_finisher') / 100;
    const execute =
      source.kind === 'ember_mouse' &&
      target.kind !== 'boss' &&
      target.maxHp !== undefined &&
      target.hp < (target.maxHp * buffDefinitions.mouse_execute.thresholdHpPercent!) / 100 &&
      bonus(s.progression, 'mouse_execute') > 0 &&
      random(s) * 100 < bonus(s.progression, 'mouse_execute');
    packets.push({ team: 'enemy', id: target.id, damage, source: source.id, execute });
  }
}
export function updateMaximumHealth(s: Combat): void {
  for (const u of s.allies) {
    const hp = maxHeroHp(u, s.progression);
    if (u.hp > 0) u.hp += hp - u.maxHp;
    u.maxHp = hp;
  }
}
export function offerNextBuff(s: Combat): void {
  if (s.result === 'defeat') {
    s.choices = [];
    s.pendingChoices = 0;
    return;
  }
  while (s.pendingChoices > 0 && !s.choices.length) {
    s.choices = drawBuffs(s.progression, s.allies, s.stageId);
    if (!s.choices.length) {
      s.fallbackIncome += 5;
      s.pendingChoices--;
    }
  }
}
export function chooseCombatBuff(s: Combat, id: BuffId): string | null {
  if (!s.choices.includes(id)) return '请选择当前提供的天赋';
  s.progression.buffs[id] = (s.progression.buffs[id] ?? 0) + 1;
  updateMaximumHealth(s);
  s.choices = [];
  s.pendingChoices--;
  offerNextBuff(s);
  return null;
}
export function collectDeaths(s: Combat): void {
  const dead = s.enemies.filter((e) => e.hp <= 0);
  for (const e of dead) {
    recordEnemyDeath(s, e);
    const kind = e.kind ?? 'wolf';
    const xp = kind === 'boss' ? bossDefinition(s.stageId).xp : enemyDefinitions[kind].xp;
    const energy =
      kind === 'boss'
        ? config.energy.bossKillGain
        : (enemyDefinitions[kind].energyGain ?? config.energy.perKill);
    s.kills++;
    s.energy = Math.min(config.energy.capacity, s.energy + energy);
    s.xpEarned += xp;
    if (s.progressionEnabled) s.pendingChoices += gainExperience(s.progression, xp);
    if (kind === 'splitter') {
      const skill = enemyDefinitions.splitter.skills;
      for (let i = 0; i < skill.onDeathSpawnCount!; i++)
        spawnEnemy(
          s,
          skill.onDeathSpawnId as EnemyKind,
          { x: Math.max(0.2, Math.min(5.8, e.x + (i ? 0.25 : -0.25))), y: e.y },
          e.id,
        );
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.attacks = s.attacks.filter((a) =>
    a.team === 'ally'
      ? s.allies.some((u) => u.id === a.source && u.hp > 0)
      : s.enemies.some((e) => e.id === a.source),
  );
  s.warnings = s.warnings.filter((w) => s.enemies.some((e) => e.id === w.source));
}
