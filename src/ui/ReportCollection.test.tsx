import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import type { StoragePort } from '../game/persistence';
import { ReportCollection } from './ReportCollection';
import { addReport, temporaryReportStorage } from './report-collection';

function markup(storage: StoragePort, isolated = false) {
  return renderToStaticMarkup(
    <ReportCollection
      storage={storage}
      isolated={isolated}
      onClose={() => {
        throw Error('渲染不得关闭');
      }}
    />,
  );
}

test('默认全部筛选、总数与最新原文可见，渲染不写收藏', () => {
  const storage = temporaryReportStorage();
  for (const [i, result] of (['defeat', 'victory'] as const).entries()) {
    addReport(
      storage,
      {
        stageId: 8,
        result,
        document: {
          fileName: `ming-defense-report-stage-8-${result}.md`,
          text: `验收原文-${result}`,
        },
      },
      1000 + i,
    );
  }
  const set = vi.spyOn(storage, 'setItem');
  const html = markup(storage);
  expect(html).toContain('aria-label="筛选收藏关卡"');
  expect(html).toContain('aria-label="筛选收藏结果"');
  expect(html.match(/value="all" selected=""/g)).toHaveLength(2);
  expect(html).toContain('匹配2 / 共2份');
  expect(html).toContain('验收原文-victory');
  expect(html).toContain('清除筛选');
  expect(html).toContain('备份仍包含全部收藏');
  expect(set).not.toHaveBeenCalled();
});

test('空库仍显示收藏指引与隔离来源，不混淆成筛选无匹配', () => {
  const html = markup(temporaryReportStorage(), true);
  expect(html).toContain('匹配0 / 共0份');
  expect(html).toContain('还没有收藏战报');
  expect(html).toContain('收藏仅本页临时保留');
  expect(html).not.toContain('没有符合条件的战报');
});

test('读取错误保留原异常提示，不显示空库或筛选计数', () => {
  const html = markup({
    getItem: () => {
      throw Error('unavailable');
    },
    setItem: () => {
      throw Error('不得写入');
    },
    removeItem: () => {
      throw Error('不得删除');
    },
  });
  expect(html).toContain('战报收藏无法读取');
  expect(html).not.toContain('还没有收藏战报');
  expect(html).not.toContain('筛选收藏关卡');
  expect(html).not.toContain('匹配0');
});
