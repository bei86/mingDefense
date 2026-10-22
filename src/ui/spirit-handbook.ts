import { appearances, heroes, tauntValue, type HeroId } from '../game/content';

type HandbookSkill = {
  name: string;
  description: string;
  fromRank: number;
  requiresTalent?: boolean;
};
export type SpiritHandbookEntry = {
  name: string;
  role: string;
  rank: number;
  hp: number;
  damage: number;
  intervalMs: number;
  range: number;
  taunt: number;
  shape: number[][];
  stats: { label: string; value: string }[];
  skills: (HandbookSkill & { unlocked: boolean })[];
};

export function spiritHandbookEntry(kind: HeroId, rank: number): SpiritHandbookEntry {
  if (!Number.isInteger(rank) || rank < 1 || rank > 6) throw new RangeError('图鉴阶数必须为1至6');
  const hero = heroes[kind];
  const skill = hero.skills;
  const skills: HandbookSkill[] = [];
  let damageLabel = '基础命中伤害';
  let damageValue = String(hero.hitDamage[rank - 1]);
  let intervalLabel = '动作间隔';
  let intervalMs = hero.actionIntervalMs;

  switch (kind) {
    case 'fortune_peach':
      damageLabel = '每次产钱';
      damageValue = '1 灵钱';
      intervalLabel = '产钱间隔';
      intervalMs = hero.incomeIntervalMs![rank - 1];
      skills.push({
        name: '灵果生财',
        description: '仅在战斗中存活时产钱；重伤停止产出。产钱间隔不受聚灵攻速加成影响。',
        fromRank: 1,
      });
      break;
    case 'shield_fox':
      damageLabel = '每次施盾';
      damageValue = `目标生命上限 ${skill.shieldPercentOfTargetMaxHp}%`;
      intervalLabel = '施盾动作间隔';
      skills.push(
        {
          name: '月音护盾',
          description: `为范围内护盾比例最低的存活队友施盾（含自身），最多积累至目标生命上限${skill.shieldCapPercentOfTargetMaxHp}%，持续${skill.shieldDurationMs! / 1000}秒；再次施盾刷新持续时间。`,
          fromRank: 1,
        },
        {
          name: '月音光环',
          description: `${skill.auraRadiusCells}格内的存活伙伴攻击提高${skill.auraAttackPercent}%；多个光环不叠加。`,
          fromRank: skill.auraFromRank!,
        },
        {
          name: '聚灵启阵',
          description: `每只上阵五阶及以上的月音狐提供${skill.startEnergy}点开场灵气，总量受灵气上限限制。`,
          fromRank: skill.startEnergyFromRank!,
        },
      );
      break;
    case 'ice_fish':
      skills.push(
        {
          name: '霜尾缓行',
          description: `命中使敌人减速${skill.slowPercent}%，持续${skill.slowDurationMs! / 1000}秒。`,
          fromRank: 1,
        },
        {
          name: '冰封',
          description: `每${skill.freezeEveryAttacks}次攻击冻结${skill.freezeDurationMs! / 1000}秒；对首领持续时间为${skill.bossFreezeMultiplierPercent}%。`,
          fromRank: skill.freezeFromRank!,
        },
      );
      break;
    case 'boar':
      skills.push(
        { name: '岩甲重击', description: '平时对单体造成基础命中伤害。', fromRank: 1 },
        {
          name: '裂地重击',
          description: `每${rank >= 5 ? skill.criticalEveryAttacksFromRank5 : skill.criticalEveryAttacks}次攻击改为${skill.criticalDamagePercent}%主击，并对${skill.splashRadiusCells}格内敌人追加基础伤害的${skill.splashDamageNumerator}/${skill.splashDamageDenominator}范围伤害，包含主目标。`,
          fromRank: skill.criticalFromRank!,
        },
        {
          name: '重击精进',
          description: `裂地重击改为每${skill.criticalEveryAttacksFromRank5}次攻击触发一次。`,
          fromRank: 5,
        },
      );
      break;
    case 'sword_eagle':
      skills.push(
        {
          name: '青锋剑雨',
          description: `每次攻击对目标周围${skill.splashRadiusCells}格内敌人造成范围伤害。`,
          fromRank: 1,
        },
        {
          name: '留阵',
          description: `留下${skill.residueDurationMs! / 1000}秒剑阵，在${skill.residueHitOffsetsMs!.map((ms) => ms / 1000).join('、')}秒各造成基础命中伤害的${skill.residueDamagePercent}%。`,
          fromRank: skill.residueFromRank!,
        },
        {
          name: '双重剑雨',
          description: `主攻击追加一段，间隔${skill.doubleMainHitOffsetMs! / 1000}秒；不会额外再生成一座剑阵。`,
          fromRank: skill.doubleMainHitFromRank!,
        },
      );
      break;
    case 'piercing_monkey':
      skills.push(
        { name: '穿林贯击', description: '沿瞄准方向攻击直线上的多个敌人。', fromRank: 1 },
        {
          name: '破甲易伤',
          description: `命中施加${skill.vulnerabilityPercent}%易伤，持续${skill.vulnerabilityDurationMs! / 1000}秒；不叠加，取较高值并刷新持续时间。`,
          fromRank: skill.vulnerabilityFromRank!,
        },
        {
          name: '双段贯击',
          description: `每次攻击追加第二段，间隔${skill.doubleHitOffsetMs! / 1000}秒，保持原方向。`,
          fromRank: skill.doubleHitFromRank!,
        },
      );
      break;
    case 'scatter_bear':
      skills.push(
        {
          name: '散射拳罡',
          description: `每次攻击释放${skill.projectileAnglesDegrees!.length}道拳罡，每道仅击中第一个敌人；近处同一敌人可中多道。基础命中伤害为每道的伤害。`,
          fromRank: 1,
        },
        {
          name: '分裂拳罡',
          description: `主拳罡命中后分裂${skill.splitCount}道，各造成${skill.splitDamagePercent}%伤害，分裂不再递归。`,
          fromRank: skill.splitsFromRank!,
        },
      );
      break;
    case 'ember_mouse':
      skills.push(
        { name: '烬火普攻', description: '单体攻击，升阶提高基础生命与命中伤害。', fromRank: 1 },
        {
          name: '天赋扩展',
          description: '低血增伤和斩杀需要另外领悟专属天赋，升阶不会自动获得。',
          fromRank: 1,
          requiresTalent: true,
        },
      );
      break;
  }

  return {
    ...appearances[kind],
    rank,
    hp: hero.hp[rank - 1],
    damage: hero.hitDamage[rank - 1],
    intervalMs,
    range: hero.rangeCells,
    taunt: tauntValue(kind),
    shape: hero.shape.map((cell) => [...cell]),
    stats: [
      { label: '基础生命', value: String(hero.hp[rank - 1]) },
      { label: damageLabel, value: damageValue },
      { label: intervalLabel, value: `${intervalMs / 1000} 秒` },
      { label: '基础射程', value: kind === 'fortune_peach' ? '不攻击' : `${hero.rangeCells} 格` },
      { label: '类型仇恨', value: String(tauntValue(kind)) },
      { label: '占用格数', value: `${hero.shape.length} 格` },
    ],
    skills: skills.map((entry) => ({ ...entry, unlocked: rank >= entry.fromRank })),
  };
}
