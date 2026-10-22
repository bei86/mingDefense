import { center, type Point } from '../game/content';
import type { Combat } from '../game/combat-model';
import type { Session } from '../game/session';

export const COMBAT_NUMBER_LIMIT = 24;
export const COMBAT_NUMBER_DURATION = 700;
export type CombatNumber = {
  id: number;
  actorId: number;
  team: 'ally' | 'enemy';
  kind: 'damage' | 'shield';
  amount: number;
  point: Point;
  born: number;
};
type Snapshot = Pick<CombatNumber, 'actorId' | 'team' | 'point'> & {
  hp: number;
  taken?: number;
  absorbed: number;
};

/** Sampled visual totals only; never written to the battle or its report. */
export class CombatNumbers {
  private battle: Combat | null | undefined;
  private battleTime = 0;
  private visible = false;
  private previous = new Map<string, Snapshot>();
  private items: CombatNumber[] = [];
  private serial = 0;

  get active(): readonly CombatNumber[] {
    return this.items;
  }

  update(session: Session, time: number, visible = true): void {
    const battle = session.battle;
    const fresh =
      this.battle !== battle ||
      (battle !== null && battle.time < this.battleTime) ||
      !visible ||
      !this.visible ||
      session.phase !== 'combat';
    const next = new Map<string, Snapshot>();
    if (battle && session.phase === 'combat') {
      const report = new Map(battle.report?.units.map((unit) => [unit.id, unit]) ?? []);
      for (const ally of battle.allies) {
        const point = center(ally.kind, ally.position);
        next.set(`ally:${ally.id}`, {
          actorId: ally.id,
          team: 'ally',
          point: { x: point.x, y: ally.position.y - 0.15 },
          hp: ally.hp,
          taken: report.get(ally.id)?.damageTaken,
          absorbed: report.get(ally.id)?.shieldAbsorbed ?? 0,
        });
      }
      for (const enemy of battle.enemies)
        next.set(`enemy:${enemy.id}`, {
          actorId: enemy.id,
          team: 'enemy',
          point: { x: enemy.x, y: enemy.y - (enemy.kind === 'boss' ? 1.05 : 0.6) },
          hp: Math.max(0, enemy.hp),
          absorbed: 0,
        });
    }
    this.items = fresh
      ? []
      : this.items.filter((item) => time - item.born < COMBAT_NUMBER_DURATION);
    if (!fresh) {
      for (const [key, actor] of next) {
        const previous = this.previous.get(key);
        if (!previous) continue;
        const damage =
          actor.taken !== undefined && previous.taken !== undefined
            ? actor.taken - previous.taken
            : previous.hp - actor.hp;
        this.add(actor, 'damage', damage, time);
        this.add(actor, 'shield', actor.absorbed - previous.absorbed, time);
      }
      // The simulation removes defeated enemies immediately after resolving hits.
      for (const [key, actor] of this.previous)
        if (actor.team === 'enemy' && !next.has(key)) this.add(actor, 'damage', actor.hp, time);
    }
    this.previous = next;
    this.battle = battle;
    this.battleTime = battle?.time ?? 0;
    this.visible = visible;
  }

  private add(actor: Snapshot, kind: CombatNumber['kind'], amount: number, time: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const sameActor = (item: CombatNumber) =>
      item.actorId === actor.actorId && item.team === actor.team && item.kind === kind;
    const recent = this.items.find((item) => sameActor(item) && time - item.born <= 180);
    if (recent) {
      recent.amount += amount;
      return;
    }
    const older = this.items.filter(sameActor);
    if (older.length >= 2) this.items = this.items.filter((item) => item !== older[0]);
    this.items.push({
      id: ++this.serial,
      actorId: actor.actorId,
      team: actor.team,
      kind,
      amount,
      point: { ...actor.point },
      born: time,
    });
    if (this.items.length > COMBAT_NUMBER_LIMIT) this.items.shift();
  }
}
