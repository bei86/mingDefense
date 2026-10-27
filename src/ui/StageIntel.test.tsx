import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createRangedPlaytest } from '../game/fixtures/ranged-playtest';
import { StageIntel } from './StageIntel';

test('默认仍打开当前关，保留当前候选出怪与原关闭文案', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  const html = renderToStaticMarkup(
    <StageIntel currentStageId={8} currentSpawns={trial.spawns} onClose={() => {}} />,
  );
  expect(html).toMatch(/<option value="8" selected="">/);
  expect(html).toContain('固定 9 只');
  expect(html).toContain('收起敌情手册');
});

test('进度预览其他关不套用当前试玩队列，返回文案不改变实际当前关', () => {
  const trial = createRangedPlaytest({ caseId: 'relief', variant: 'candidate' });
  const before = JSON.stringify(trial.session.exportSave());
  const html = renderToStaticMarkup(
    <StageIntel
      currentStageId={8}
      currentSpawns={trial.spawns}
      initialStageId={10}
      closeLabel="返回战役进度"
      onClose={() => {
        throw Error('不在渲染执行关闭');
      }}
    />,
  );
  expect(html).toMatch(/<option value="10" selected="">/);
  expect(html).toContain('第8关 · 鸣咒来袭（当前）');
  expect(html).toContain('固定出场 13 只');
  expect(html).toContain('返回战役进度');
  expect(JSON.stringify(trial.session.exportSave())).toBe(before);
});
