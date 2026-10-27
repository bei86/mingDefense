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
  expect(html).toContain('aria-label="波次时间表"');
  expect(html.match(/第\d波时段/g)).toHaveLength(3);
  expect(html).toContain('翎羽客 × 3');
  expect(html).not.toContain('翎羽客 × 4');
  expect(html).toContain('出怪不等待前一波清完');
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
  expect(html).toContain('鸣咒统领 × 1');
  expect(JSON.stringify(trial.session.exportSave())).toBe(before);
});

test('空时段保留波次起点，不伪造出场时间', () => {
  const html = renderToStaticMarkup(
    <StageIntel currentStageId={50} currentSpawns={[]} onClose={() => {}} />,
  );
  expect(html.match(/本时段无固定出场/g)).toHaveLength(2);
  expect(html).toContain('起点 00:05');
  expect(html).not.toContain('首末出场');
});
