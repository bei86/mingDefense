import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import { runPreparedBattle } from '../game/testing/campaign-battle';
import { ResultModal } from './CampaignPanels';
import { StageIntel } from './StageIntel';
import { RangedPlaytestPanel } from './RangedPlaytest';
import { stageIntel } from './stage-intel';
import { temporaryReportStorage } from './report-collection';

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
