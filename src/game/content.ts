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
  'piercing_monkey',
  'scatter_bear',
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
  piercing_monkey: { name: '穿林猿', color: '#dfbe83', glyph: '贯', role: '贯穿 · 横 3 格' },
  scatter_bear: { name: '磐拳熊', color: '#b9bdcf', glyph: '拳', role: '散射 · 竖 2 格' },
};
export type EnemyKind =
  | 'wolf'
  | 'runner'
  | 'croc'
  | 'summoned_wolf'
  | 'summoner'
  | 'splitter'
  | 'split_fragment'
  | 'ranged'
  | 'boss';
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
export const stageNames = [
  '林间初袭',
  '疾影来袭',
  '霜径追逐',
  '石鳞重围',
  '古木之怒',
  '翎羽侵林',
  '疾羽交锋',
  '鸣咒来袭',
  '裂岩重围',
  '群啸之主',
  '疾羽重围',
  '石径追猎',
  '咒影围林',
  '裂岩狂潮',
  '岩铠之主',
  '疾羽围猎',
  '咒影追袭',
  '碎岩奔潮',
  '鸣咒重围',
  '霜咒之主',
  '疾雷合围',
  '岩咒追猎',
  '裂影奔袭',
  '群咒压境',
  '岩咒之主',
  '雷岩夹击',
  '疾咒围猎',
  '碎影狂潮',
  '岩影重围',
  '玄羽之主',
  '赤岩奔袭',
  '咒雷围猎',
  '碎羽狂潮',
  '岩咒压境',
  '赤角之主',
  '雷甲围猎',
  '疾咒追袭',
  '裂雷狂潮',
  '群咒重围',
  '玄甲之主',
  '羽岩长阵',
  '咒影疾潮',
  '裂甲奔袭',
  '群影合围',
  '回锋之主',
  '雷羽长驱',
  '咒岩合围',
  '裂羽奔潮',
  '万影压境',
  '镇渊终战',
];
type BossDefinition = typeof config.boss & {
  summonFromStart?: boolean;
  damageReductionPercent?: number;
  phase2SummonCount?: number;
  cleaveEchoDelayMs?: number;
  cleaveEchoDamagePercent?: number;
};
const bossDefinitions: BossDefinition[] = [
  config.boss,
  config.secondBoss,
  config.thirdBoss,
  config.fourthBoss,
  config.fifthBoss,
  config.sixthBoss,
  config.seventhBoss,
  config.eighthBoss,
  config.ninthBoss,
  config.tenthBoss,
];
export function bossDefinition(stageId: number): BossDefinition {
  const id = stages[stageId - 1].bossId;
  if (!id) return config.boss;
  const boss = bossDefinitions.find((b) => b.id === id);
  if (!boss) throw new Error(`首领配置缺失: ${id}`);
  return boss;
}
export const enemyAppearances: Record<EnemyKind, { name: string; description: string }> = {
  wolf: { name: '奔雷狼', description: '近战；第6关起存活越久攻击越高' },
  runner: { name: '疾影犬', description: '高速近战' },
  croc: { name: '岩甲兽', description: '高生命，减伤15%' },
  ranged: { name: '翎羽客', description: '远程攻击，仍先清前排' },
  summoner: {
    name: '鸣咒犬',
    description: `出生${enemyDefinitions.summoner.skills.firstSummonDelayMs! / 1000}秒后首次召唤，之后每20秒召2只，每只鸣咒犬上限6只`,
  },
  splitter: { name: '裂岩犀', description: '死亡分裂2只碎岩灵' },
  split_fragment: { name: '碎岩灵', description: '不会再次分裂' },
  summoned_wolf: { name: '咒影', description: '召唤物，不提供经验和灵气' },
  boss: { name: '首领', description: '技能预警后攻击前排' },
};
export function bossName(stageId: number): string {
  switch (bossDefinition(stageId).id) {
    case config.tenthBoss.id:
      return '镇渊妖君';
    case config.ninthBoss.id:
      return '回锋妖将';
    case config.secondBoss.id:
      return '鸣咒统领';
    case config.thirdBoss.id:
      return '岩铠领主';
    case config.eighthBoss.id:
      return '玄甲咒尊';
    case config.seventhBoss.id:
      return '赤角战魁';
    case config.sixthBoss.id:
      return '玄羽妖帅';
    case config.fifthBoss.id:
      return '岩咒督军';
    case config.fourthBoss.id:
      return '霜咒祭司';
    default:
      return '古木之灵';
  }
}
export function bossDescription(stageId: number): string {
  const skill = bossDefinition(stageId);
  const effects = [];
  if (skill.rangeCells > 1) effects.push(`远程射程${skill.rangeCells}格，仍先清前排`);
  if (skill.damageReductionPercent) effects.push(`岩铠减伤${skill.damageReductionPercent}%`);
  effects.push(
    skill.summonFromStart ? '开场起周期召唤' : `生命降至${skill.phase2HpPercent}%后开始召唤`,
  );
  effects.push(
    `生命降至${skill.phase2HpPercent}%时攻速提高${skill.phase2AttackSpeedBonusPercent}%`,
  );
  effects.push(`横扫预警${skill.cleaveWarningMs / 1000}秒后攻击前排`);
  if (skill.cleaveEchoDelayMs)
    effects.push(
      `双段横扫：首段后${skill.cleaveEchoDelayMs / 1000}秒追击锁定同一行，造成首段${skill.cleaveEchoDamagePercent}%伤害，不跳后排`,
    );
  effects.push(
    `每${skill.summonIntervalMs / 1000}秒召${skill.summonCount}只咒影，上限${skill.maxLivingSummons}只`,
  );
  if (skill.phase2SummonCount)
    effects.push(`生命降至${skill.phase2HpPercent}%后每次召${skill.phase2SummonCount}只`);
  return effects.join('；') + '。';
}
export function tauntValue(kind: HeroId): number {
  return config.targeting.tauntTieOrder.length - config.targeting.tauntTieOrder.indexOf(kind);
}
export function projectileSkillDescription(
  kind: HeroId,
  rank: number,
  vulnerabilityBonus = 0,
): string | null {
  const skill = heroes[kind].skills;
  if (kind === 'piercing_monkey') {
    const effects = ['直线贯穿'];
    if (rank >= skill.vulnerabilityFromRank!)
      effects.push(
        `命中易伤 ${skill.vulnerabilityPercent! + vulnerabilityBonus}% · ${skill.vulnerabilityDurationMs! / 1000}秒`,
      );
    if (rank >= skill.doubleHitFromRank!) effects.push('每次攻击两段');
    return effects.join(' · ');
  }
  if (kind === 'scatter_bear') {
    const effects = [`${skill.projectileAnglesDegrees!.length}道拳罡 · 每道首个敌人受击`];
    if (rank >= skill.splitsFromRank!)
      effects.push(`命中分裂${skill.splitCount}道 · 各${skill.splitDamagePercent}%伤害 · 不再分裂`);
    return effects.join(' · ');
  }
  return null;
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
export const totalEnemies = enemyCount(1);
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
