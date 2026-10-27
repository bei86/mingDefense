import { bossDefinition, bossName, center, type EnemyKind, type Point } from '../game/content';
import type { Combat, Flash, Warning } from '../game/combat-model';
import type { Session } from '../game/session';
import { CombatNumbers } from './combat-numbers';
import { combatSound, type SoundCue } from './sound-cues';

export type { SoundCue } from './sound-cues';
type Team = 'ally' | 'enemy';
type Actor = {
  id: number;
  team: Team;
  point: Point;
  hp: number;
  absorbed: number;
  frozen: boolean;
  movingUntil: number;
  hitAt: number;
  attackAt: number;
  deadAt: number;
  direction: Point;
};
export type Ghost = {
  kind: EnemyKind;
  stageId: number;
  phase2: boolean;
  point: Point;
  born: number;
};
export type CombatNotice = {
  id: number;
  kind: 'boss' | 'phase' | 'warning';
  label: string;
  detail: string;
  born: number;
  duration: number;
};

/** Disposable presentation state, sampled after simulation without modifying it. */
export class CombatFeedback {
  time = 0;
  readonly numbers = new CombatNumbers();
  notice: CombatNotice | null = null;
  ghosts: Ghost[] = [];
  private battle: Combat | null | undefined;
  private battleTime = 0;
  private phase: Session['phase'] | undefined;
  private level = 0;
  private income = 0;
  private preparation = new Map<number, { rank: number; kind: string; position: string }>();
  private actors = new Map<string, Actor>();
  private enemies = new Map<number, { kind: EnemyKind; phase2: boolean; point: Point }>();
  private flashes = new WeakSet<Flash>();
  // Freeze changes due times; object identity still identifies the same warning.
  private warnings = new WeakSet<Warning>();
  private serial = 0;

  update(session: Session, deltaMs: number, visible = true, numbersEnabled = true): SoundCue[] {
    if (visible && (session.phase === 'prepare' || session.canAdvance))
      this.time += Math.max(0, Math.min(100, deltaMs)) * session.speed;
    this.numbers.update(session, this.time, visible && numbersEnabled);
    const battle = session.battle;
    const fresh = this.battle !== battle || (battle !== null && battle.time < this.battleTime);
    const starting = fresh && this.phase === 'prepare' && session.phase === 'combat';
    const cues = new Set<SoundCue>();
    if (fresh) {
      this.actors.clear();
      this.enemies.clear();
      this.ghosts = [];
      this.notice = null;
      this.flashes = new WeakSet(battle?.flashes ?? []);
      this.warnings = new WeakSet(battle?.warnings ?? []);
    }
    if (!fresh && session.phase === 'prepare') {
      const units = session.preparation.units;
      const rollback = units.some((u) => u.rank < (this.preparation.get(u.id)?.rank ?? u.rank));
      if (!rollback)
        for (const unit of units) {
          const previous = this.preparation.get(unit.id);
          if (previous && previous.kind === unit.kind && unit.rank > previous.rank)
            cues.add('merge');
          else if (
            unit.position &&
            (!previous || previous.position !== JSON.stringify(unit.position))
          )
            cues.add('deploy');
        }
    }
    if (battle) {
      const report = new Map(battle.report?.units.map((u) => [u.id, u.shieldAbsorbed]) ?? []);
      const current = new Set<string>();
      for (const unit of battle.allies)
        this.track(
          'ally',
          unit.id,
          center(unit.kind, unit.position),
          unit.hp,
          report.get(unit.id) ?? 0,
          false,
          current,
        );
      for (const enemy of battle.enemies) {
        this.track(
          'enemy',
          enemy.id,
          enemy,
          enemy.hp,
          0,
          (enemy.frozenUntil ?? 0) > battle.time,
          current,
        );
        const previous = this.enemies.get(enemy.id);
        if ((!fresh || starting) && enemy.kind === 'boss') {
          if (!previous) {
            cues.add('boss');
            this.announce('boss', bossName(battle.stageId), '首领现身 · 守住阵线', 1800);
          } else if (enemy.phase2 && !previous.phase2) {
            cues.add('phase');
            this.announce('phase', '怒意苏醒', `${bossName(battle.stageId)} · 进入二阶段`, 1800);
          }
        }
      }
      if (!fresh) {
        for (const [id, enemy] of this.enemies)
          if (!current.has(`enemy:${id}`))
            this.ghosts.push({ ...enemy, stageId: battle.stageId, born: this.time });
        this.ghosts = this.ghosts.slice(-24);
        if (battle.income > this.income) cues.add('income');
        if (battle.progression.level > this.level) cues.add('levelup');
        for (const flash of battle.flashes) {
          if (this.flashes.has(flash)) continue;
          this.flashes.add(flash);
          cues.add(combatSound(flash));
          const actor = [...this.actors.values()].find(
            (a) =>
              a.team === flash.team &&
              a.hp > 0 &&
              Math.hypot(a.point.x - flash.from.x, a.point.y - flash.from.y) < 0.12,
          );
          if (actor) {
            const dx = flash.to.x - flash.from.x;
            const dy = flash.to.y - flash.from.y;
            const distance = Math.hypot(dx, dy) || 1;
            actor.attackAt = this.time;
            actor.direction = { x: dx / distance, y: dy / distance };
          }
        }
        for (const warning of battle.warnings)
          if (!warning.echo && !this.warnings.has(warning)) {
            const double = !!bossDefinition(battle.stageId).cleaveEchoDelayMs;
            cues.add('warning');
            this.announce(
              'warning',
              double ? '双段横扫将至' : '横扫将至',
              `第 ${warning.row + 1} 行 · ${double ? '两段锁定同一行' : '留意阵线'}`,
              Math.min(1400, warning.due - battle.time),
            );
          }
        if (
          session.phase !== this.phase &&
          (session.phase === 'victory' || session.phase === 'defeat')
        )
          cues.add(session.phase);
      }
      for (const key of this.actors.keys()) if (!current.has(key)) this.actors.delete(key);
      this.enemies = new Map(
        battle.enemies.map((e) => [
          e.id,
          {
            kind: e.kind ?? 'wolf',
            phase2: e.phase2 ?? false,
            point: { x: e.x, y: e.y },
          },
        ]),
      );
    }
    this.battle = battle;
    this.battleTime = battle?.time ?? 0;
    this.phase = session.phase;
    this.income = battle?.income ?? 0;
    this.level = battle?.progression.level ?? 0;
    this.warnings = new WeakSet(battle?.warnings ?? []);
    this.preparation = new Map(
      session.preparation.units.map((u) => [
        u.id,
        {
          rank: u.rank,
          kind: u.kind,
          position: JSON.stringify(u.position),
        },
      ]),
    );
    this.ghosts = this.ghosts.filter((g) => this.time - g.born < 300);
    if (this.notice && this.time - this.notice.born >= this.notice.duration) this.notice = null;
    return visible ? [...cues] : [];
  }

  pose(team: Team, id: number, reducedMotion = false) {
    const actor = this.actors.get(`${team}:${id}`);
    let dx = 0,
      dy = 0,
      rotation = 0,
      scale = 1,
      alpha = 1;
    let tint = 0xffffff;
    if (actor) {
      if (this.time - actor.hitAt < 140) tint = 0xffd4b8;
      if (actor.hp <= 0) alpha = 0.28 + 0.72 * Math.max(0, 1 - (this.time - actor.deadAt) / 260);
      else if (!reducedMotion && !actor.frozen) {
        const wave = Math.sin(this.time / 340 + id * 0.8);
        scale = 1 + wave * 0.009;
        dy = wave * 0.5;
        if (actor.movingUntil > this.time) {
          dy -= Math.abs(Math.sin(this.time / 85 + id)) * 1.8;
          rotation = Math.sin(this.time / 85 + id) * 0.025;
        }
        const age = this.time - actor.attackAt;
        if (age >= 0 && age < 180) {
          const pulse = Math.sin((age / 180) * Math.PI);
          dx += actor.direction.x * 4 * pulse;
          dy += actor.direction.y * 4 * pulse;
          rotation += actor.direction.x * 0.06 * pulse;
        }
      }
    }
    return { dx, dy, rotation, scale, alpha, tint };
  }

  private track(
    team: Team,
    id: number,
    point: Point,
    hp: number,
    absorbed: number,
    frozen: boolean,
    current: Set<string>,
  ): void {
    const key = `${team}:${id}`;
    current.add(key);
    const previous = this.actors.get(key);
    if (!previous) {
      this.actors.set(key, {
        team,
        id,
        point: { x: point.x, y: point.y },
        hp,
        absorbed,
        frozen,
        movingUntil: 0,
        hitAt: -Infinity,
        attackAt: -Infinity,
        deadAt: -Infinity,
        direction: { x: 0, y: 0 },
      });
      return;
    }
    if (previous.hp > hp || absorbed > previous.absorbed) previous.hitAt = this.time;
    if (previous.hp > 0 && hp <= 0) previous.deadAt = this.time;
    if (Math.hypot(previous.point.x - point.x, previous.point.y - point.y) > 0.001)
      previous.movingUntil = this.time + 100;
    previous.point = { x: point.x, y: point.y };
    previous.hp = hp;
    previous.absorbed = absorbed;
    previous.frozen = frozen;
  }

  private announce(
    kind: CombatNotice['kind'],
    label: string,
    detail: string,
    duration: number,
  ): void {
    const priority = { boss: 2, phase: 3, warning: 1 };
    if (
      this.notice &&
      this.time - this.notice.born < this.notice.duration &&
      priority[this.notice.kind] > priority[kind]
    )
      return;
    this.notice = { id: ++this.serial, kind, label, detail, duration, born: this.time };
  }
}
