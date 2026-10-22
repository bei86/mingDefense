import { appearances } from '../game/content';
import { placementError, type Session, type Source } from '../game/session';

export type FirstBattleHint = {
  kind: 'deploy' | 'merge' | 'ready' | 'recruit';
  title: string;
  description: string;
  source?: Source;
  sourceName?: string;
};

export function firstBattleGuide(session: Session): FirstBattleHint | null {
  const p = session.preparation;
  if (session.phase !== 'prepare' || p.stageId !== 1) return null;

  const deployed = p.units.filter((u) => u.position);
  const available = [
    ...p.units.map((u) => ({
      source: { type: 'unit' as const, id: u.id },
      kind: u.kind,
      rank: u.rank,
      onBoard: Boolean(u.position),
    })),
    ...p.offers.flatMap((o) =>
      o.claimed || o.kind === 'cell'
        ? []
        : [
            {
              source: { type: 'offer' as const, id: o.id },
              kind: o.kind,
              rank: o.rank ?? 1,
              onBoard: false,
            },
          ],
    ),
  ];

  if (!p.units.some((u) => u.rank > 1)) {
    for (const target of deployed) {
      const candidate = available.find(
        (u) =>
          !(u.source.type === 'unit' && u.source.id === target.id) &&
          u.kind === target.kind &&
          u.rank === target.rank &&
          target.rank < session.maxRank,
      );
      if (candidate) {
        const name = appearances[target.kind].name;
        return {
          kind: 'merge',
          title: '同种同阶，叠放升阶',
          description: `选中另一只${name}，点第${target.position!.x + 1}列第${target.position!.y + 1}行的${name}，合成${target.rank + 1}阶；也可拖动叠放。`,
          source: candidate.source,
          sourceName: `${name} · ${candidate.rank}阶`,
        };
      }
    }
  }

  const candidate = available.find(
    (u) =>
      !u.onBoard &&
      p.unlocked.some((cell) => {
        const [x, y] = cell.split(',').map(Number);
        return !placementError(p, u.kind, { x, y });
      }),
  );
  if (candidate) {
    const skin = appearances[candidate.kind];
    const origin = candidate.source.type === 'unit' ? '备战席' : '免费招募';
    return {
      kind: 'deploy',
      title: deployed.length ? '让更多灵兽上阵' : '先部署一只灵兽',
      description: `选中${origin}中的${skin.name}（${skin.role}），点亮起的空地部署，也可拖动。备战席中的灵兽不参战。`,
      source: candidate.source,
      sourceName: `${skin.name} · ${candidate.rank}阶`,
    };
  }

  if (deployed.length)
    return {
      kind: 'ready',
      title: '检查阵容，准备守阵',
      description: `已上阵${deployed.length}只灵兽。确认有输出灵兽后，向下点「开始守阵」。还可移动调整；同种同阶可合成，多格灵兽需要连续空地。`,
    };

  return {
    kind: 'recruit',
    title: '先准备可上阵的灵兽',
    description:
      '至少部署一只灵兽才能开战。可检查备战席、调整空位或使用扩地令；没有灵兽时，可花费15灵钱刷新招募。',
  };
}
