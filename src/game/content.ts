import balance from '../../docs/superpowers/specs/2026-10-14-prototype-balance.json';

export const config = balance;
export const m1HeroIds = ['ember_mouse', 'boar', 'sword_eagle'] as const;
export const heroIds = [
  'ember_mouse',
  'boar',
  'sword_eagle',
  'fortune_peach',
  'ice_fish',
  'shield_fox',
] as const;
export type HeroId = (typeof heroIds)[number];
export type Point = { x: number; y: number };
export const heroes = Object.fromEntries(
  heroIds.map((id) => [id, balance.units.find((u) => u.id === id)!]),
) as Record<HeroId, (typeof balance.units)[number]>;
export const appearances: Record<
  HeroId,
  { name: string; color: string; glyph: string; role: string }
> = {
  ember_mouse: { name: '烬灵鼠', color: '#eeaa69', glyph: '火', role: '单体 · 1 格' },
  boar: { name: '岩甲豚', color: '#b9cf89', glyph: '岩', role: '重击 · 横 2 格' },
  sword_eagle: { name: '青锋隼', color: '#94d8db', glyph: '剑', role: '群攻 · 2×2 格' },
  fortune_peach: { name: '灵金桃', color: '#f3b7b2', glyph: '桃', role: '产钱 · 1 格' },
  ice_fish: { name: '霜尾鲤', color: '#a4c9f2', glyph: '冰', role: '控制 · 竖 3 格' },
  shield_fox: { name: '月音狐', color: '#dcc6ec', glyph: '盾', role: '护盾 · 1 格' },
};
export type EnemyKind = 'wolf' | 'runner' | 'croc' | 'summoned_wolf' | 'boss';
export type Stage = {
  id: number;
  hpMultiplier: number;
  attackMultiplier: number;
  reward: number;
  bossId?: string;
  waves: { atMs: number; enemies: Partial<Record<EnemyKind, number>> }[];
};
export const stages = config.stages as Stage[];
export const enemyDefinitions = Object.fromEntries(config.enemies.map((e) => [e.id, e]));
export const stageNames = ['林间初袭', '疾影来袭', '霜径追逐', '石鳞重围', '古木之怒'];
export function tauntValue(kind: HeroId): number {
  return config.targeting.tauntTieOrder.length - config.targeting.tauntTieOrder.indexOf(kind);
}
export function enemyCount(stageId: number): number {
  const value = stages[stageId - 1];
  return value.waves.reduce(
    (sum, wave) => sum + Object.values(wave.enemies).reduce((n, count) => n + count, 0),
    value.bossId ? 1 : 0,
  );
}
export const wolf = balance.enemies.find((e) => e.id === 'wolf')!;
export const stage = balance.stages[0];
export const totalEnemies = stage.waves.reduce((total, wave) => total + wave.enemies.wolf, 0);
export const key = (p: Point) => `${p.x},${p.y}`;
export const cells = (kind: HeroId, p: Point): Point[] =>
  heroes[kind].shape.map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
export function center(kind: HeroId, p: Point): Point {
  const shape = cells(kind, p);
  return {
    x: shape.reduce((n, c) => n + c.x + 0.5, 0) / shape.length,
    y: shape.reduce((n, c) => n + c.y + 0.5, 0) / shape.length,
  };
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const clone = <T>(value: T): T => structuredClone(value);

// Content remains a single JSON source. Fail early if a future edit breaks the campaign.
for (const id of heroIds) {
  const u = heroes[id];
  if (
    !u ||
    u.hp.length !== 6 ||
    u.hitDamage.length !== 6 ||
    !u.hp.every((n) => Number.isInteger(n) && n > 0) ||
    !u.hitDamage.every((n) => Number.isInteger(n) && n >= 0) ||
    !u.shape.length ||
    new Set(u.shape.map(([x, y]) => `${x},${y}`)).size !== u.shape.length ||
    !u.shape.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0) ||
    u.windupMs < 0 ||
    u.rangeCells < 0 ||
    u.actionIntervalMs < config.runtime.tickMs
  ) {
    throw new Error(`灵兽配置无效: ${id}`);
  }
}
