import type { Combat } from '../game/combat-model';
import { appearances } from '../game/content';

export const fallTimelineMissing = '这份旧战报未记录重伤时间。';
export const fallTimelineEmpty = '本关无灵兽重伤。';
export const fallTimelineNote = '按游戏内时间每0.05秒记录，同一批灵兽不区分重伤先后。';

/** Shared by the result panel and exported/collected text. */
export function fallTimeline(battle: Combat): string[] | null {
  const falls = battle.report?.falls;
  if (!falls) return null;
  return falls.map((batch) => {
    const units = batch.unitIds.map((id) => {
      const ally = battle.allies.find((u) => u.id === id)!;
      return `${appearances[ally.kind].name} ${ally.rank}阶（${ally.position.x + 1}列${ally.position.y + 1}行）`;
    });
    return `${(batch.at / 1000).toFixed(2)} 秒：${units.join('、')}`;
  });
}
