import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TextExport } from './TextExport';

test('分享码和JSON完整只读导出，不强加下载入口，选择按钮关联各自文本框', () => {
  const texts = ['分享码\n中文 <>& "末尾"', '{"schema":2,"中文":"完整备份"}'];
  const html = renderToStaticMarkup(
    <>
      {texts.map((text, index) => (
        <TextExport
          key={index}
          text={text}
          label={`完整文本${index}`}
          copyLabel={`复制文本${index}`}
          copiedNotice="已复制"
        />
      ))}
    </>,
  );
  expect(html).toContain('分享码\n中文 &lt;&gt;&amp; &quot;末尾&quot;');
  expect(html).toContain('{&quot;schema&quot;:2,&quot;中文&quot;:&quot;完整备份&quot;}');
  expect(html.match(/readOnly=""/g)).toHaveLength(2);
  expect(html.match(/选中文本/g)).toHaveLength(2);
  expect(html).not.toContain('下载');
  const ids = [...html.matchAll(/<textarea[^>]+id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(2);
  ids.forEach((id, index) => {
    expect(html).toContain(`aria-controls="${id}"`);
    expect(html).toContain(`for="${id}">完整文本${index}`);
  });
});

test('SSR展示自定义下载和收藏入口，不执行任何用户动作', () => {
  const unexpected = () => {
    throw new Error('只能由用户点击触发');
  };
  const html = renderToStaticMarkup(
    <TextExport
      text="固定快照"
      label="诊断全文"
      copyLabel="复制诊断报告"
      copiedNotice="诊断报告已复制。"
      download={{ label: '下载诊断报告', run: unexpected }}
      onCollect={unexpected}
    />,
  );
  expect(html).toContain('复制诊断报告');
  expect(html).toContain('下载诊断报告');
  expect(html).toContain('收藏到本地');
  expect(html).toContain('select-report-text');
  expect(html).not.toContain('正在复制');
  expect(html).not.toContain('诊断报告已复制。');
});
