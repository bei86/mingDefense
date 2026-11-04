import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { MotionPreview } from './MotionPreview';

vi.mock('../render/MotionPreviewField', () => ({
  MotionPreviewField: () => <div role="img" aria-label="动作画布占位" />,
}));

afterEach(() => vi.unstubAllGlobals());

test('控件标注完整，默认待机加载中，返回链接保留部署路径；渲染不接触浏览器存储', () => {
  const denied = new Proxy(
    {},
    {
      get() {
        throw Error('预览禁止访问存储');
      },
    },
  );
  vi.stubGlobal('localStorage', denied);
  vi.stubGlobal('sessionStorage', denied);
  const html = renderToStaticMarkup(<MotionPreview pathname="/game/" />);
  expect(html).toContain('烬灵鼠动作预览');
  expect(html).toContain('不读取或写入战役进度');
  expect(html).toContain('真实攻击时机请进入八灵实战对照');
  expect(html).toContain('role="group" aria-label="选择动作"');
  expect(html).toContain('aria-pressed="true">待机');
  for (const label of ['攻击', '受击', '重伤', '上一帧', '下一帧', '重播', '减少动态', '浅色背景'])
    expect(html).toContain(label);
  expect(html).toContain('正在加载四组动作素材');
  expect(html).toContain('min="0" max="3"');
  expect(html).toContain('aria-valuetext="第1帧，共4帧"');
  expect(html).toContain('href="/game/?playtest=roster"');
  expect(html).toContain('href="/game/"');
});
