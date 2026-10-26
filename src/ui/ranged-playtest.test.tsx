import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import { runPreparedBattle } from '../game/testing/campaign-battle';
import { ResultModal } from './CampaignPanels';
import { StageIntel } from './StageIntel';
import { RangedPlaytestPanel } from './RangedPlaytest';
import { stageIntel } from './stage-intel';
import { temporaryReportStorage } from './report-collection';
import { RangedResultsView } from './RangedResults';
import { rangedResult } from './ranged-results';

test('候选敌情数量与真实调度一致，普通关卡保持原数量', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  const intel = stageIntel(8, trial.spawns);
  expect(intel.enemies.find((e) => e.kind === 'ranged')?.count).toBe(9);
  expect(intel.enemies.find((e) => e.kind === 'wolf')?.count).toBe(15);
  expect(stageIntel(8).enemies.find((e) => e.kind === 'ranged')?.count).toBe(12);
  const html = renderToStaticMarkup(
    <StageIntel currentStageId={8} currentSpawns={trial.spawns} onClose={() => {}} />,
  );
  expect(html).toContain('固定 9 只');
  expect(html).toContain('固定 15 只');
});

test.each(['baseline', 'candidate'] as const)(
  '%s单关结算替换推进动作，普通结算保留动作',
  (variant) => {
    const trial = createRangedPlaytest({ caseId: 'relief', variant });
    runPreparedBattle(trial.session, 'assault', false);
    const noop = () => {};
    const props = {
      session: trial.session,
      isolated: true,
      reportStorage: temporaryReportStorage(),
      onReports: noop,
      onSaves: noop,
      onNext: noop,
      onRetry: noop,
      onPrepare: noop,
      onReset: noop,
    };
    const html = renderToStaticMarkup(
      <ResultModal {...props} trialActions={<RangedPlaytestPanel trial={trial} />} />,
    );
    expect(html).toContain('重置本方案');
    expect(html).not.toContain('前往第');
    expect(html).not.toContain('免费重试');
    expect(html).not.toContain('重新开始五十关挑战');
    const normal = renderToStaticMarkup(<ResultModal {...props} />);
    expect(normal).toContain('重新开始五十关挑战');
    expect(normal).toContain(variant === 'baseline' ? '免费重试' : '前往第');
  },
);

test('最近战果显示缺侧和真实差异，报告/清空控件不带下一关操作', () => {
  const baseline = createRangedPlaytest({ caseId: 'relief', variant: 'baseline' });
  const candidate = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  runPreparedBattle(baseline.session, 'assault', false);
  runPreparedBattle(candidate.session, 'assault', false);
  const results = [rangedResult(baseline, 1000)!, rangedResult(candidate, 2000)!];
  const render = (entries: typeof results) =>
    renderToStaticMarkup(
      <RangedResultsView results={{ entries, error: null }} caseId="relief" onClear={() => {}} />,
    );
  expect(render([])).toContain('尚无完整战果');
  expect(render([results[0]])).toContain('未试玩');
  const html = render(results);
  expect(html).toContain('1695');
  expect(html).toContain('3619');
  expect(html).toContain('开战档相同');
  expect(html).toContain('结束累计天赋不同');
  expect(html).toContain('复制战报');
  expect(html).toContain('下载 Markdown');
  expect(html).toContain('试玩对照报告');
  expect(html).toContain('清空本标签页试玩记录');
  expect(html).not.toContain('前往第');
});
