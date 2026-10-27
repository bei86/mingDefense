export const playtestScenes = [
  {
    id: 'onboarding',
    label: '首战 · 从零布阵',
    stage: 1,
    description: '独立新局，从免费招募开始，检查首战指引与正常操作。',
  },
  {
    id: 'roster',
    label: '八灵 · 技能验收',
    stage: 1,
    description: '人工固定八灵阵容，用于查看技能与占格；不代表正常经济路线。',
  },
  {
    id: 'ranged8',
    label: '第8关 · 远程对照',
    stage: 8,
    description:
      'v24三格合法开局，默认获益案例与原方案；进入后可切换案例和远程减少方案，仅试玩本关。',
  },
  {
    id: 'calibration40',
    label: '第40关 · 首领试玩',
    stage: 40,
    description: '既有v22三格合法经济路线检查点，未使用聚灵；加载后按当前规则运行。',
  },
  {
    id: 'stage50',
    label: '第50关 · 终战试玩',
    stage: 50,
    description: '既有v24三格合法控制路线检查点，未使用聚灵；加载后按当前规则运行。',
  },
] as const;

export function playtestUrl(id: string, diagnostics: boolean, pathname: string): string | null {
  if (!playtestScenes.some((scene) => scene.id === id)) return null;
  const query = new URLSearchParams({ playtest: id });
  if (diagnostics) query.set('perf', '1');
  return `${pathname}?${query}`;
}
