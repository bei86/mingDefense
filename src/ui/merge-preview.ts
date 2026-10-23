import { heroes } from '../game/content';
import { maxHeroHp } from '../game/combat-skills';
import { mergeError, sourceUnit, type Preparation, type Source, type Unit } from '../game/session';
import { spiritHandbookEntry } from './spirit-handbook';

export function mergeLocation(p: Preparation, unit: Unit): string {
  if (unit.position) return `${unit.position.x + 1}列${unit.position.y + 1}行起`;
  const seat = p.units.filter((u) => !u.position).findIndex((u) => u.id === unit.id) + 1;
  return `备战席${seat}（不参战）`;
}

/** Read-only projection; the actual command validates the same source and target again. */
export function mergePreview(p: Preparation, source: Source, maxRank: number) {
  const unit = sourceUnit(p, source);
  if (!unit) return { error: '所选灵兽或招募已不可用，请关闭后重新选择。' } as const;
  if (!Number.isInteger(unit.rank) || unit.rank < 1 || unit.rank > 6)
    return { error: '阶数数据不可用，请关闭后重新选择。' } as const;
  if (unit.rank >= maxRank || unit.rank >= 6)
    return { error: `已达本模式最高${Math.min(maxRank, 6)}阶，无法继续合成。` } as const;
  const before = spiritHandbookEntry(unit.kind, unit.rank);
  const after = spiritHandbookEntry(unit.kind, unit.rank + 1);
  const candidates = p.units.filter((target) => !mergeError(p, source, target.id, maxRank));
  let sourceRelease = '腾出来源所在的1个备战席。';
  if (source.type === 'offer') sourceRelease = '领取这张招募，其他招募保留。';
  else if (unit.position) sourceRelease = `腾出来源原占的${heroes[unit.kind].shape.length}格。`;
  return {
    unit,
    candidates,
    stats: before.stats.slice(0, 4).map((stat, index) => ({
      label: stat.label,
      before: stat.value,
      after: after.stats[index].value,
    })),
    newSkills: after.skills.filter(
      (skill) =>
        skill.unlocked &&
        !skill.requiresTalent &&
        !before.skills.find((previous) => previous.name === skill.name)?.unlocked,
    ),
    combinedHp: maxHeroHp(unit, p.progression) * 2,
    resultHp: maxHeroHp({ ...unit, rank: unit.rank + 1 }, p.progression),
    sourceLocation: source.type === 'offer' ? '未领取招募' : mergeLocation(p, unit),
    sourceRelease,
  };
}
