import { center, config, distance, heroes, type HeroId, type Point } from '../game/content';
import type { Ally, Combat } from '../game/combat';
import { attackDamage, heroRange } from '../game/combat-skills';
import { bonus } from '../game/progression';

export type BattleStatsModel = {
  kind: HeroId;
  rank: number;
  position: Point;
  alive: boolean;
  rows: { label: string; value: string }[];
  auraSources: { id: number; rank: number; position: Point }[];
  auraTargets: { id: number; kind: HeroId; rank: number; position: Point }[];
};

function auraCovers(fox: Ally, target: Ally): boolean {
  const skill = heroes.shield_fox.skills;
  return (
    fox.hp > 0 &&
    fox.kind === 'shield_fox' &&
    fox.rank >= skill.auraFromRank! &&
    target.hp > 0 &&
    target.kind !== 'shield_fox' &&
    target.kind !== 'fortune_peach' &&
    distance(center(fox.kind, fox.position), center(target.kind, target.position)) <=
      skill.auraRadiusCells!
  );
}

function number(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** Read the existing battle, including current talents and surviving aura sources. */
export function battleStats(battle: Combat | null, unitId: number): BattleStatsModel | null {
  const ally = battle?.allies.find((unit) => unit.id === unitId);
  if (!battle || !ally) return null;
  const model: BattleStatsModel = {
    kind: ally.kind,
    rank: ally.rank,
    position: { ...ally.position },
    alive: ally.hp > 0,
    rows: [],
    auraSources: [],
    auraTargets: [],
  };
  if (!model.alive) return model;
  const hero = heroes[ally.kind];
  const progression = battle.progression;
  if (ally.kind === 'fortune_peach') {
    model.rows.push(
      { label: '每次产钱', value: '1 灵钱' },
      {
        label: '产钱间隔',
        value: `${number(hero.incomeIntervalMs![ally.rank - 1] / 1000)} 秒`,
      },
    );
    return model;
  }
  if (ally.kind === 'shield_fox') {
    model.auraTargets = battle.allies
      .filter((unit) => auraCovers(ally, unit))
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id)
      .map((unit) => ({
        id: unit.id,
        kind: unit.kind,
        rank: unit.rank,
        position: { ...unit.position },
      }));
    model.rows.push({
      label: '单次施盾比例',
      value: `${number(hero.skills.shieldPercentOfTargetMaxHp! * (1 + bonus(progression, 'fox_shield') / 100))}%`,
    });
  } else {
    model.rows.push({ label: '基础命中值', value: number(attackDamage(battle, ally)) });
    model.auraSources = battle.allies
      .filter((unit) => auraCovers(unit, ally))
      .map((unit) => ({ id: unit.id, rank: unit.rank, position: { ...unit.position } }));
  }
  function interval(boosted: boolean): string {
    const speed = Math.min(
      config.damage.attackSpeedBonusCapPercent,
      bonus(progression, 'attack_speed') + (boosted ? config.energy.attackSpeedBonusPercent : 0),
    );
    const ticks = Math.ceil(hero.actionIntervalMs / (1 + speed / 100) / config.runtime.tickMs);
    return `${number((ticks * config.runtime.tickMs) / 1000)} 秒`;
  }
  model.rows.push(
    {
      label: ally.kind === 'shield_fox' ? '施盾射程' : '寻敌射程',
      value: `${number(heroRange(ally, progression))} 格`,
    },
    { label: '常态动作间隔', value: interval(false) },
    { label: '聚灵动作间隔', value: interval(true) },
  );
  return model;
}
