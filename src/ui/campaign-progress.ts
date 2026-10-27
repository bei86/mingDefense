import { stages, stageNames } from '../game/content';
import type { Session } from '../game/session';

export type CampaignProgressEntry = {
  id: number;
  name: string;
  boss: boolean;
  current: boolean;
  cleared: boolean;
  status: '已守住' | '当前关' | '未记录' | '未到达';
};

export function campaignProgress(session: Session) {
  const { stageId, rewardedStages } = session.preparation;
  const rewarded = new Set(rewardedStages);
  const entries = stages.map((stage): CampaignProgressEntry => {
    const current = stage.id === stageId;
    const cleared = rewarded.has(stage.id);
    let status: CampaignProgressEntry['status'] = '未到达';
    if (cleared) status = '已守住';
    else if (current) status = '当前关';
    else if (stage.id < stageId) status = '未记录';
    return {
      id: stage.id,
      name: stageNames[stage.id - 1],
      boss: Boolean(stage.bossId),
      current,
      cleared,
      status,
    };
  });
  const states = {
    prepare: '整备布阵',
    combat: session.paused ? '守卫已暂停' : '正在守卫',
    victory: '本关已守住',
    defeat: '本关未守住',
  };
  let currentState = states[session.phase];
  if (session.hasChoices) currentState = '待选天赋';
  if (session.complete) currentState = '五十关已完成';
  return {
    entries,
    chapters: Array.from({ length: Math.ceil(entries.length / 10) }, (_, index) =>
      entries.slice(index * 10, (index + 1) * 10),
    ),
    current: entries[stageId - 1],
    currentState,
    cleared: entries.filter((entry) => entry.cleared).length,
    total: entries.length,
    bossesCleared: entries.filter((entry) => entry.boss && entry.cleared).length,
    bossesTotal: entries.filter((entry) => entry.boss).length,
  };
}
