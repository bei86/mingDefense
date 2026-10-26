import type { Combat, Enemy, Packet } from './combat-model';
import type { EnemyKind } from './content';

export type EnemyAttack = 'basic' | 'cleave' | 'echo' | 'unknown';
type DamageSource = {
  sourceId: number | null;
  kind: EnemyKind | 'unknown';
  owner?: number;
  attack: EnemyAttack;
};
export type EnemyDamageRow = DamageSource & {
  targetId: number;
  hits: number;
  hpLoss: number;
  shieldAbsorbed: number;
  lethal: number;
  firstAt: number;
  lastAt: number;
};
export type EnemyDamageReport = {
  startedAt: number;
  completeFromStart: boolean;
  rows: EnemyDamageRow[];
};
type Observation = Omit<EnemyDamageReport, 'rows'> & { rows: Map<string, EnemyDamageRow> };

// Observations and packet metadata never enter Combat, saves or gameplay/RNG.
const observations = new WeakMap<Combat, Observation>();
const sources = new WeakMap<Packet, DamageSource>();

export function observeEnemyDamage(s: Combat): void {
  if (observations.has(s)) return;
  observations.set(s, {
    startedAt: s.time,
    completeFromStart:
      s.time === 0 &&
      s.damageTaken === 0 &&
      !s.report?.units.some((u) => u.damageTaken > 0 || u.shieldAbsorbed > 0),
    rows: new Map(),
  });
}

export function tagEnemyDamage(s: Combat, packet: Packet, enemy: Enemy, attack: EnemyAttack): void {
  if (!observations.has(s)) return;
  sources.set(packet, {
    sourceId: enemy.id,
    kind: enemy.kind ?? 'wolf',
    ...(enemy.owner === undefined ? {} : { owner: enemy.owner }),
    attack,
  });
}

export function recordEnemyDamage(
  s: Combat,
  packet: Packet,
  hpLoss: number,
  shieldAbsorbed: number,
  lethal: boolean,
): void {
  const observation = observations.get(s);
  if (!observation || packet.team !== 'ally' || (hpLoss <= 0 && shieldAbsorbed <= 0)) return;
  const source =
    sources.get(packet) ??
    ({
      sourceId: null,
      kind: 'unknown',
      attack: 'unknown',
    } satisfies DamageSource);
  const key = `${source.sourceId}:${packet.id}:${source.attack}`;
  let row = observation.rows.get(key);
  if (!row) {
    row = {
      ...source,
      targetId: packet.id,
      hits: 0,
      hpLoss: 0,
      shieldAbsorbed: 0,
      lethal: 0,
      firstAt: s.time,
      lastAt: s.time,
    };
    observation.rows.set(key, row);
  }
  row.hits++;
  row.hpLoss += hpLoss;
  row.shieldAbsorbed += shieldAbsorbed;
  row.lethal += Number(lethal);
  row.lastAt = s.time;
}

export function enemyDamageSnapshot(s: Combat): EnemyDamageReport | null {
  const observation = observations.get(s);
  if (!observation) return null;
  return {
    startedAt: observation.startedAt,
    completeFromStart: observation.completeFromStart,
    rows: [...observation.rows.values()]
      .map((row) => ({ ...row }))
      .sort(
        (a, b) =>
          (a.sourceId ?? -1) - (b.sourceId ?? -1) ||
          a.targetId - b.targetId ||
          a.attack.localeCompare(b.attack),
      ),
  };
}
