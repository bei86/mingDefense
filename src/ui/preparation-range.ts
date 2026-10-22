import { appearances, center, distance, heroes, type HeroId, type Point } from '../game/content';
import { heroRange } from '../game/combat-skills';
import type { Unit } from '../game/model';
import { placementError, unitAt, type Preparation, type Source } from '../game/session';
import { boardDrop } from './board-drop';

export type RangeCircle = { kind: 'attack' | 'shield' | 'aura'; radius: number };
export type RangePreview = {
  name: string;
  kind: HeroId;
  rank: number;
  status: 'current' | 'placement' | 'merge' | 'unplaced' | 'invalid';
  point: Point | null;
  circles: RangeCircle[];
  covered: { id: number; point: Point; shield: boolean; aura: boolean }[];
  error?: string;
};

export function preparationRange(
  preparation: Preparation,
  source: Source | null,
  hover: Point | null,
  dragOffset: Point | null,
  maxRank: number,
): RangePreview | null {
  if (!source) return null;
  const existing =
    source.type === 'unit' ? preparation.units.find((u) => u.id === source.id) : null;
  const offer =
    source.type === 'offer'
      ? preparation.offers.find((o) => o.id === source.id && !o.claimed)
      : null;
  if (!existing && (!offer || offer.kind === 'cell')) return null;
  const projected: Unit = existing
    ? { ...existing }
    : {
        id: preparation.nextId,
        kind: offer!.kind as HeroId,
        rank: offer!.rank ?? 1,
        position: null,
      };
  const preview: RangePreview = {
    name: appearances[projected.kind].name,
    kind: projected.kind,
    rank: projected.rank,
    status: projected.position ? 'current' : 'unplaced',
    point: null,
    circles: [],
    covered: [],
  };
  let mergedId: number | undefined;
  // Selecting any occupied cell of a large unit must retain its real anchor.
  const overSelf = existing && hover && unitAt(preparation, hover)?.id === existing.id;
  if (hover && !(overSelf && !dragOffset)) {
    const destination = boardDrop(preparation, source, hover, dragOffset ?? undefined);
    if ('merge' in destination) {
      const target = preparation.units.find((u) => u.id === destination.merge)!;
      if (target.kind !== projected.kind || target.rank !== projected.rank)
        preview.error = '只有同种、同阶灵兽可以合成';
      else if (target.rank >= maxRank) preview.error = `本模式最高为 ${maxRank} 阶`;
      else {
        projected.position = target.position;
        projected.rank++;
        preview.rank = projected.rank;
        preview.status = 'merge';
        mergedId = target.id;
      }
    } else {
      preview.error =
        placementError(preparation, projected.kind, destination, existing?.id) ?? undefined;
      if (!preview.error) {
        projected.position = destination;
        preview.status = 'placement';
      }
    }
  }
  if (preview.error) return { ...preview, status: 'invalid' };
  if (!projected.position) return preview;
  preview.point = center(projected.kind, projected.position);
  if (projected.kind === 'fortune_peach') return preview;
  const range = heroRange(projected, preparation.progression);
  preview.circles.push({
    kind: projected.kind === 'shield_fox' ? 'shield' : 'attack',
    radius: range,
  });
  if (projected.kind !== 'shield_fox') return preview;
  const skill = heroes.shield_fox.skills;
  const aura = projected.rank >= skill.auraFromRank!;
  if (aura) preview.circles.push({ kind: 'aura', radius: skill.auraRadiusCells! });
  preview.covered = preparation.units
    .filter((u) => u.position && u.id !== existing?.id && u.id !== mergedId)
    .map((u) => {
      const point = center(u.kind, u.position!);
      const d = distance(preview.point!, point);
      return { id: u.id, point, shield: d <= range, aura: aura && d <= skill.auraRadiusCells! };
    })
    .filter((u) => u.shield || u.aura);
  return preview;
}

export function rangeDescription(preview: RangePreview): string {
  if (preview.status === 'invalid') return `此处不可放置：${preview.error}。范围未显示。`;
  if (!preview.point) return '选择空地或拖到棋盘，预览放置后的范围。';
  if (preview.kind === 'fortune_peach')
    return '灵金桃定时产钱，没有攻击范围；移到后排通常更容易存活。';
  const shield = preview.circles.find((circle) => circle.kind === 'shield');
  if (shield) {
    const count = preview.covered.filter((u) => u.shield).length;
    const aura = preview.circles.find((circle) => circle.kind === 'aura');
    const auraNote = aura
      ? `金色虚线光环${aura.radius}格，覆盖${preview.covered.filter((u) => u.aura).length}位伙伴，另含自身。`
      : `光环${heroes.shield_fox.skills.auraFromRank}阶解锁。`;
    return `紫圈施盾${shield.radius}格，可覆盖${count}位伙伴，另含自身；一次只为一个目标施盾。${auraNote}`;
  }
  return `金圈寻敌射程${preview.circles[0].radius}格，已计入本轮射程天赋。圈内不代表全部命中，群攻、贯穿与散射另算。`;
}
