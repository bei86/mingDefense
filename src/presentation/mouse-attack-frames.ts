import { center, config } from '../game/content';
import type { Combat, Flash } from '../game/combat-model';

type Motion = { ordinal: number; started: number; due: number; released: number };

/** Read-only animation projection. A cancelled windup can never invent a release. */
export class MouseAttackFrames {
  private battle: Combat | null = null;
  private time = 0;
  private motions = new Map<number, Motion>();
  private flashes = new WeakSet<Flash>();

  update(battle: Combat | null): void {
    const fresh = battle !== this.battle || (battle !== null && battle.time < this.time);
    if (fresh) {
      this.motions.clear();
      this.flashes = new WeakSet(battle?.flashes ?? []);
    }
    this.battle = battle;
    this.time = battle?.time ?? 0;
    if (!battle) return;
    const mice = battle.allies.filter((unit) => unit.kind === 'ember_mouse' && unit.hp > 0);
    const alive = new Set(mice.map((unit) => unit.id));
    for (const id of this.motions.keys()) if (!alive.has(id)) this.motions.delete(id);
    for (const mouse of mice) {
      const pending = battle.attacks.find(
        (attack) =>
          attack.team === 'ally' &&
          attack.source === mouse.id &&
          battle.enemies.some((enemy) => enemy.id === attack.target && enemy.hp > 0),
      );
      let motion = this.motions.get(mouse.id);
      if (!motion) {
        motion = { ordinal: -1, started: this.time, due: this.time, released: -Infinity };
        this.motions.set(mouse.id, motion);
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
      if (flash.team !== 'ally' || flash.kind !== 'ember_mouse') continue;
      const mouse = mice.find((unit) => {
        const point = center(unit.kind, unit.position);
        return Math.hypot(point.x - flash.from.x, point.y - flash.from.y) < 0.12;
      });
      // Flash.at is the start of the resolved simulation step; readers see its end.
      if (mouse) this.motions.get(mouse.id)!.released = flash.at + config.runtime.tickMs;
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
