import type { FoxSource } from './fox-support';

export function sourcesText(sources: FoxSource[]): string {
  return sources
    .map(
      (fox) => `狐${fox.rank}阶 · 编号${fox.id}（${fox.position.x + 1}列${fox.position.y + 1}行）`,
    )
    .join('、');
}
