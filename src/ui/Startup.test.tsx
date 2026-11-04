import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

const { appImported } = vi.hoisted(() => ({ appImported: vi.fn() }));
vi.mock('./App', () => {
  appImported();
  return { App: () => <main>正式游戏</main> };
});
vi.mock('./MotionPreview', () => ({
  MotionPreview: ({ pathname }: { pathname: string }) => <main>预览路径：{pathname}</main>,
}));
afterEach(() => vi.unstubAllGlobals());

test('预览在GameApp导入前分流，不先创建正式游戏或读取战役档', async () => {
  vi.stubGlobal('window', {
    location: { search: '?preview=mouse-motion&playtest=roster', pathname: '/game/' },
    get localStorage() {
      throw Error('不允许读取正式档');
    },
  });
  const { Startup } = await import('./Startup');
  renderToStaticMarkup(<Startup />);
  await vi.dynamicImportSettled();
  const html = renderToStaticMarkup(<Startup />);
  expect(html).toContain('预览路径：/game/');
  expect(appImported).not.toHaveBeenCalled();
});
