import { center, config, distance, heroes, type HeroId, type Point } from '../game/content';
import { createCombat } from '../game/combat';
import { attackDamage, heroRange } from '../game/combat-skills';
import { bonus } from '../game/progression';
import type { Preparation } from '../game/session';

type StatRow = { label: string; base: string; current: string };
export type PreparationStatsModel = {
  kind: HeroId;
  rank: number;
  position: Point;
  rows: StatRow[];
  auraSources: { id: number; rank: number; position: Point }[];
};

function number(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** Observe a fresh opening lineup without starting or advancing the session. */
export function preparationStats(p: Preparation, unitId: number): PreparationStatsModel | null {
  if (!p.units.some((unit) => unit.id === unitId && unit.position)) return null;
  const battle = createCombat(p.units, {
    stageId: p.stageId,
    progression: p.progression,
    rng: p.combatRng,
  });
  const ally = battle.allies.find((unit) => unit.id === unitId)!;
  const hero = heroes[ally.kind];
  const rows: StatRow[] = [
    { label: '最大生命', base: String(hero.hp[ally.rank - 1]), current: String(ally.maxHp) },
  ];
  const auraSources: PreparationStatsModel['auraSources'] = [];
  if (ally.kind === 'fortune_peach') {
    const interval = `${number(hero.incomeIntervalMs![ally.rank - 1] / 1000)} 秒`;
    rows.push(
      { label: '每次产钱', base: '1 灵钱', current: '1 灵钱' },
      { label: '产钱间隔', base: interval, current: interval },
    );
  } else {
    if (ally.kind === 'shield_fox') {
      const shield = hero.skills.shieldPercentOfTargetMaxHp!;
      rows.push({
        label: '单次施盾比例',
        base: `${shield}%`,
        current: `${number(shield * (1 + bonus(p.progression, 'fox_shield') / 100))}%`,
      });
    } else {
      rows.push({
        label: '基础命中值',
        base: String(hero.hitDamage[ally.rank - 1]),
        current: number(attackDamage(battle, ally)),
      });
      const point = center(ally.kind, ally.position);
      const skill = heroes.shield_fox.skills;
      for (const unit of battle.allies) {
        if (
          unit.kind === 'shield_fox' &&
          unit.rank >= skill.auraFromRank! &&
          distance(center(unit.kind, unit.position), point) <= skill.auraRadiusCells!
        )
          auraSources.push({ id: unit.id, rank: unit.rank, position: { ...unit.position } });
      }
    }
    function interval(boosted: boolean): string {
      const speed = Math.min(
        config.damage.attackSpeedBonusCapPercent,
        bonus(p.progression, 'attack_speed') +
          (boosted ? config.energy.attackSpeedBonusPercent : 0),
      );
      const ticks = Math.ceil(hero.actionIntervalMs / (1 + speed / 100) / config.runtime.tickMs);
      return `${number((ticks * config.runtime.tickMs) / 1000)} 秒`;
    }
    rows.push(
      {
        label: '常态动作间隔',
        base: `${number(hero.actionIntervalMs / 1000)} 秒`,
        current: interval(false),
      },
      { label: '聚灵动作间隔', base: '—', current: interval(true) },
      {
        label: ally.kind === 'shield_fox' ? '施盾射程' : '寻敌射程',
        base: `${number(hero.rangeCells)} 格`,
        current: `${number(heroRange(ally, p.progression))} 格`,
      },
    );
  }
  return { kind: ally.kind, rank: ally.rank, position: { ...ally.position }, rows, auraSources };
}
