import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ReportText } from './ReportText';

test('手动复制保留完整只读正文，与原复制/下载动作和标签正确关联', () => {
  const text = '完整战报\n中文 <>& "引号"\n末尾';
  const html = renderToStaticMarkup(
    <ReportText report={{ fileName: 'report.md', text }} label="测试战报" />,
  );
  expect(html).toContain('复制战报');
  expect(html).toContain('下载 Markdown');
  expect(html).toContain('选中文本');
  expect(html).toContain('readOnly=""');
  expect(html).toContain('完整战报\n中文 &lt;&gt;&amp; &quot;引号&quot;\n末尾');
  const id = html.match(/<textarea[^>]+id="([^"]+)"/)![1];
  expect(html).toContain(`aria-controls="${id}"`);
  expect(html).toContain(`for="${id}">测试战报（可手动全选复制）`);
  expect(html).not.toContain('正在复制');
});

test('收藏入口与手动选择兼容，多份报告不会共用文本框ID', () => {
  const report = { fileName: 'report.md', text: '相同的正文' };
  const html = renderToStaticMarkup(
    <>
      <ReportText report={report} label="报告一" onCollect={() => '已收藏'} />
      <ReportText report={report} label="报告二" />
    </>,
  );
  expect(html.match(/收藏到本地/g)).toHaveLength(1);
  const ids = [...html.matchAll(/<textarea[^>]+id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(2);
  expect(html.match(/选中文本/g)).toHaveLength(2);
});
