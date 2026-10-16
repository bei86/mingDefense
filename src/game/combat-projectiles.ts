import { center, config, heroes, type Point } from './content';
import type { Ally, Combat, Enemy, LineHit, Packet } from './combat-model';
import { bonus } from './progression';

function direction(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length < 1e-9
    ? { x: 0, y: -1 }
    : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}
function rotate(vector: Point, degrees: number): Point {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  };
}
function rayHits(
  s: Combat,
  from: Point,
  vector: Point,
  range: number,
  halfWidth: number,
  exclude?: number,
) {
  const radius = halfWidth + config.targeting.enemyBodyRadiusCells;
  return s.enemies
    .filter((e) => e.hp > 0 && e.id !== exclude)
    .map((enemy) => {
      const dx = enemy.x - from.x;
      const dy = enemy.y - from.y;
      const along = dx * vector.x + dy * vector.y;
      const across = dx * vector.y - dy * vector.x;
      const entry = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - across * across)));
      return { enemy, along, across, entry };
    })
    .filter((hit) => hit.along >= 0 && hit.along <= range && Math.abs(hit.across) <= radius)
    .sort((a, b) => a.entry - b.entry || a.enemy.id - b.enemy.id);
}
export function releaseLineHit(s: Combat, hit: LineHit, packets: Packet[]): void {
  for (const { enemy } of rayHits(s, hit.point, hit.direction, hit.range, hit.halfWidth))
    packets.push({
      team: 'enemy',
      id: enemy.id,
      damage: hit.damage,
      source: hit.source,
      vulnerability: hit.vulnerability,
    });
  s.flashes.push({
    from: hit.point,
    to: {
      x: hit.point.x + hit.direction.x * hit.range,
      y: hit.point.y + hit.direction.y * hit.range,
    },
    at: s.time,
    team: 'ally',
    kind: hit.kind,
  });
}
export function releaseMonkeyAttack(
  s: Combat,
  source: Ally,
  target: Enemy,
  damage: number,
  packets: Packet[],
): void {
  const skill = heroes.piercing_monkey.skills;
  const point = center(source.kind, source.position);
  const hit: LineHit = {
    shape: 'line',
    due: s.time,
    source: source.id,
    kind: source.kind,
    damage,
    point,
    direction: direction(point, target),
    range: heroes.piercing_monkey.rangeCells + bonus(s.progression, 'range'),
    halfWidth: skill.lineWidthCells! / 2,
    vulnerability:
      source.rank >= skill.vulnerabilityFromRank!
        ? {
            percent: skill.vulnerabilityPercent! + bonus(s.progression, 'monkey_vulnerability'),
            durationMs: skill.vulnerabilityDurationMs!,
          }
        : undefined,
  };
  releaseLineHit(s, hit, packets);
  if (source.rank >= skill.doubleHitFromRank!)
    s.released.push({ ...hit, due: s.time + skill.doubleHitOffsetMs! });
}
export function releaseBearAttack(
  s: Combat,
  source: Ally,
  target: Enemy,
  damage: number,
  packets: Packet[],
): void {
  const skill = heroes.scatter_bear.skills;
  const from = center(source.kind, source.position);
  const aim = direction(from, target);
  const halfWidth = skill.projectileHalfWidthCells!;
  const range = heroes.scatter_bear.rangeCells + bonus(s.progression, 'range');
  function projectile(
    point: Point,
    vector: Point,
    length: number,
    amount: number,
    exclude?: number,
  ): Enemy | undefined {
    const first = rayHits(s, point, vector, length, halfWidth, exclude)[0]?.enemy;
    if (first) packets.push({ team: 'enemy', id: first.id, damage: amount, source: source.id });
    s.flashes.push({
      from: point,
      to: first
        ? { x: first.x, y: first.y }
        : { x: point.x + vector.x * length, y: point.y + vector.y * length },
      at: s.time,
      team: 'ally',
      kind: source.kind,
    });
    return first;
  }
  for (const angle of skill.projectileAnglesDegrees!) {
    const vector = rotate(aim, angle);
    const first = projectile(from, vector, range, damage);
    if (first && source.rank >= skill.splitsFromRank!)
      for (const splitAngle of skill.splitAnglesDegrees!)
        projectile(
          { x: first.x, y: first.y },
          rotate(vector, splitAngle),
          skill.splitRangeCells!,
          (damage * skill.splitDamagePercent!) / 100,
          first.id,
        );
  }
}
