import { center, type Point } from '../game/content';
import type { Combat, Flash } from '../game/combat-model';
import type { Session } from '../game/session';
import type { ArtKey } from './art';

type TransientKey = 'fx_income' | 'fx_summon' | 'fx_merge' | 'fx_levelup';
export type FieldEffect = {
  key: TransientKey;
  point: Point;
  born: number;
  duration: number;
};

/** Presentation-only snapshots. Nothing is stored in the simulation or save. */
export class FieldEffects {
  private battle: Combat | null | undefined;
  private ranks = new Map<number, number>();
  private income = new Map<number, number>();
  private enemies = new Set<number>();
  private level = 0;
  private clock = 0;
  private active: FieldEffect[] = [];

  update(session: Session, deltaMs: number): { effect: FieldEffect; progress: number }[] {
    if (session.phase === 'prepare' || session.canAdvance)
      this.clock += Math.max(0, Math.min(100, deltaMs)) * session.speed;
    const battle = session.battle;
    const units = battle?.allies ?? session.preparation.units;
    const level = battle?.progression.level ?? session.preparation.progression.level;
    const fresh = this.battle !== battle;
    const rolledBack =
      level < this.level ||
      (units.length === 0 && this.ranks.size > 0) ||
      units.some((unit) => unit.rank < (this.ranks.get(unit.id) ?? unit.rank));
    if (fresh || rolledBack) this.active = [];

    if (!fresh && !rolledBack) {
      for (const unit of units) {
        if (!unit.position) continue;
        const point = center(unit.kind, unit.position);
        const previousRank = this.ranks.get(unit.id);
        if (session.phase === 'prepare' && previousRank !== undefined && unit.rank > previousRank)
          this.add('fx_merge', point, 600);
        if (battle && unit.kind === 'fortune_peach') {
          const income = battle.report?.units.find((entry) => entry.id === unit.id)?.income ?? 0;
          if (income > (this.income.get(unit.id) ?? income)) this.add('fx_income', point, 650);
        }
      }
      if (battle && level > this.level)
        for (const ally of battle.allies)
          if (ally.hp > 0) this.add('fx_levelup', center(ally.kind, ally.position), 900);
      if (battle)
        for (const enemy of battle.enemies)
          if (
            enemy.kind === 'summoned_wolf' &&
            enemy.owner !== undefined &&
            !this.enemies.has(enemy.id)
          )
            this.add('fx_summon', { x: enemy.x, y: enemy.y }, 700);
    }

    this.battle = battle;
    this.level = level;
    this.ranks = new Map(units.map((unit) => [unit.id, unit.rank]));
    this.income = new Map(battle?.report?.units.map((entry) => [entry.id, entry.income]) ?? []);
    this.enemies = new Set(battle?.enemies.map((enemy) => enemy.id) ?? []);
    this.active = this.active.filter((effect) => this.clock - effect.born < effect.duration);
    return this.active.map((effect) => ({
      effect,
      progress: (this.clock - effect.born) / effect.duration,
    }));
  }

  private add(key: TransientKey, point: Point, duration: number): void {
    this.active.push({ key, point: { ...point }, born: this.clock, duration });
    if (this.active.length > 48) this.active.shift();
  }
}

export type AttackEffect = {
  key: ArtKey;
  point: Point;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
};

/** Sizes are in cells; images describe existing hit flashes, never new projectiles. */
export function attackEffect(flash: Flash, time: number): AttackEffect | null {
  const age = time - flash.at;
  if (flash.team !== 'ally' || age < 0 || age >= 300) return null;
  const dx = flash.to.x - flash.from.x;
  const dy = flash.to.y - flash.from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return null;
  const progress = age / 300;
  const angle = Math.atan2(dy, dx);
  const effect = {
    point: { x: flash.from.x + dx * progress, y: flash.from.y + dy * progress },
    rotation: angle,
    alpha: 0.85 * (1 - progress),
  };
  if (flash.kind === 'ember_mouse')
    return {
      ...effect,
      key: 'fx_fireball',
      width: 0.55,
      height: 0.8,
      rotation: angle + Math.PI / 2,
    };
  if (flash.kind === 'scatter_bear')
    return { ...effect, key: 'fx_fist', width: 0.95, height: 0.55 };
  if (flash.kind === 'piercing_monkey')
    return {
      ...effect,
      key: 'fx_pierce',
      point: { x: (flash.from.x + flash.to.x) / 2, y: (flash.from.y + flash.to.y) / 2 },
      width: Math.min(5.5, length),
      height: 0.45,
    };
  return null;
}
