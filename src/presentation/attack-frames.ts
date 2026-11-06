import { center, config } from '../game/content';
import type { Combat, Flash } from '../game/combat-model';

type Motion = { ordinal: number; started: number; due: number; released: number };

/** Read-only animation projection. A cancelled windup can never invent a release. */
export class AttackFrames {
  private battle: Combat | null = null;
  private time = 0;
  private motions = new Map<number, Motion>();
  private flashes = new WeakSet<Flash>();

  constructor(private readonly kind: 'ember_mouse' | 'boar') {}

  update(battle: Combat | null): void {
    const fresh = battle !== this.battle || (battle !== null && battle.time < this.time);
    if (fresh) {
      this.motions.clear();
      this.flashes = new WeakSet(battle?.flashes ?? []);
    }
    this.battle = battle;
    this.time = battle?.time ?? 0;
    if (!battle) return;
    const units = battle.allies.filter((unit) => unit.kind === this.kind && unit.hp > 0);
    const alive = new Set(units.map((unit) => unit.id));
    for (const id of this.motions.keys()) if (!alive.has(id)) this.motions.delete(id);
    for (const unit of units) {
      const pending = battle.attacks.find(
        (attack) =>
          attack.team === 'ally' &&
          attack.source === unit.id &&
          battle.enemies.some((enemy) => enemy.id === attack.target && enemy.hp > 0),
      );
      let motion = this.motions.get(unit.id);
      if (!motion) {
        motion = { ordinal: -1, started: this.time, due: this.time, released: -Infinity };
        this.motions.set(unit.id, motion);
      }
      if (pending) {
        if (motion.ordinal !== pending.ordinal) motion.started = this.time;
        motion.ordinal = pending.ordinal;
        motion.due = pending.due;
      } else {
        motion.ordinal = -1;
      }
    }
    for (const flash of battle.flashes) {
      if (this.flashes.has(flash)) continue;
      this.flashes.add(flash);
      if (flash.team !== 'ally' || flash.kind !== this.kind) continue;
      const unit = units.find((unit) => {
        const point = center(unit.kind, unit.position);
        return Math.hypot(point.x - flash.from.x, point.y - flash.from.y) < 0.12;
      });
      // Flash.at is the start of the resolved simulation step; readers see its end.
      if (unit) this.motions.get(unit.id)!.released = flash.at + config.runtime.tickMs;
    }
  }

  active(id: number): boolean {
    if (this.battle?.result) return false;
    const motion = this.motions.get(id);
    if (!motion) return false;
    const age = this.time - motion.released;
    return motion.ordinal >= 0 || (age >= 0 && age < 210);
  }

  frame(id: number, reducedMotion = false): number {
    if (reducedMotion || this.battle?.result) return 0;
    const motion = this.motions.get(id);
    if (!motion) return 0;
    if (motion.ordinal >= 0) {
      const duration = Math.max(1, motion.due - motion.started);
      return Math.min(2, Math.max(0, Math.floor((3 * (this.time - motion.started)) / duration)));
    }
    const age = this.time - motion.released;
    return age >= 0 && age < 210 ? 3 + Math.floor(age / 70) : 0;
  }
}
