import { appearances, config, heroes } from '../game/content';
import type { Combat, UnitBattleStats } from '../game/combat-model';
import { placementError, type Preparation } from '../game/session';
import { firstFallSnapshot, type FirstFall } from './defeat-formation';

export type DefeatRecap = {
  stageId: number;
  cause: 'fallen' | 'timeout' | 'unknown';
  title: string;
  detail: string;
  damageFact?: string;
  firstFall?: FirstFall | null;
};

export type PreparationTip = { id: string; text: string };

export function defeatRecap(battle: Combat | null): DefeatRecap | null {
  if (battle?.result !== 'defeat') return null;
  const survivors = battle.allies.filter((u) => u.hp > 0).length;
  let cause: DefeatRecap['cause'] = 'unknown';
  let title = '本次未守住';
  let detail = '可返回整备，结合逐兽战报调整后再试。';
  if (!survivors) {
    cause = 'fallen';
    title = '上阵灵兽全部重伤';
    detail = '本次因阵容生命耗尽而结束，可先检查上阵数量与前排安排。';
  } else if (battle.time >= config.runtime.stageLimitMs) {
    cause = 'timeout';
    title = '守阵时间耗尽';
    detail = `结束时仍有${survivors}只灵兽存活，但时限内未完成清场，可先检查输出与升阶。`;
  }

  const mostDamage = battle.report?.units.reduce<UnitBattleStats | undefined>(
    (best, entry) => (entry.damageTaken > (best?.damageTaken ?? 0) ? entry : best),
    undefined,
  );
  const ally = battle.allies.find((u) => u.id === mostDamage?.id);
  const damageFact =
    ally && mostDamage
      ? `${appearances[ally.kind].name}${ally.rank}阶（第${ally.position.x + 1}列第${ally.position.y + 1}行）本次承受生命伤害最多：${Math.floor(mostDamage.damageTaken)}，不含护盾吸收。`
      : undefined;
  return {
    stageId: battle.stageId,
    cause,
    title,
    detail,
    damageFact,
    firstFall: firstFallSnapshot(battle),
  };
}

export function preparationAdvice(
  p: Preparation,
  maxRank: number,
  recap: DefeatRecap,
): PreparationTip[] {
  if (p.stageId !== recap.stageId) return [];
  const tips: PreparationTip[] = [];
  const deployed = p.units.filter((u) => u.position);
  const candidates = [
    ...p.units.map((u) => ({ ...u, source: 'unit' as const })),
    ...p.offers.flatMap((o) =>
      o.claimed || o.kind === 'cell'
        ? []
        : [{ id: o.id, kind: o.kind, rank: o.rank ?? 1, position: null, source: 'offer' as const }],
    ),
  ];
  const points = p.unlocked.map((cell) => {
    const [x, y] = cell.split(',').map(Number);
    return { x, y };
  });
  const recruit = candidates.find(
    (u) => !u.position && points.some((point) => !placementError(p, u.kind, point)),
  );
  if (recruit)
    tips.push({
      id: 'deploy',
      text: `${recruit.source === 'unit' ? '备战席' : '未领取招募'}中的${appearances[recruit.kind].name}${recruit.rank}阶目前有可用空位，可免费上阵。备战席灵兽不参战，多格占位需完整连续。`,
    });

  for (const target of deployed) {
    if (target.rank >= maxRank) continue;
    const source = candidates.find(
      (u) =>
        !(u.source === 'unit' && u.id === target.id) &&
        u.kind === target.kind &&
        u.rank === target.rank,
    );
    if (source) {
      tips.push({
        id: 'merge',
        text: `有两只${target.rank}阶${appearances[target.kind].name}可合成。选中另一只，叠放到第${target.position!.x + 1}列第${target.position!.y + 1}行的同种灵兽，可升至${target.rank + 1}阶。合成会减少一只灵兽，注意阵容数量。`,
      });
      break;
    }
  }

  if (!deployed.some((u) => heroes[u.kind].hitDamage[u.rank - 1] > 0))
    tips.push({
      id: 'output',
      text: '当前棋盘缺少能造成伤害的灵兽。先部署攻击型灵兽，产钱和护盾灵兽需要输出伙伴。',
    });
  else if (recap.cause === 'timeout')
    tips.push({
      id: 'tactics',
      text: '可尝试补充或升阶输出灵兽，战斗时利用聚灵提升攻速；保留足够生存能力，避免只增加产钱或护盾。',
    });
  else
    tips.push({
      id: 'tactics',
      text: '敌人先清最前一排；同排先低阶，同阶按仇恨选择。可尝试调整前后排、升阶或搭配控制与护盾，观察下次承伤变化。',
    });
  return tips.slice(0, 3);
}
