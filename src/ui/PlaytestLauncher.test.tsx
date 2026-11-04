import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { PlaytestLauncher } from './PlaytestLauncher';
import type { Phase } from '../game/session';

function markup(phase: Phase, isolated = false) {
  return renderToStaticMarkup(
    <PlaytestLauncher
      pathname="/game/"
      phase={phase}
      isolated={isolated}
      onClose={() => {
        throw Error('渲染不得关闭');
      }}
      onNavigate={() => {
        throw Error('渲染不得导航');
      }}
    />,
  );
}

test('入口默认首战和诊断开启，提供场景来源与离开提示，不在渲染时执行动作', () => {
  const html = markup('prepare');
  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-modal="true"');
  expect(html).toContain('<option value="onboarding" selected="">');
  expect(html.match(/<option /g)).toHaveLength(5);
  expect(html).toContain('checked=""');
  expect(html).toContain('开启性能诊断');
  expect(html).toContain('独立新局');
  expect(html).toContain('先导出');
  expect(html).toContain('不会覆盖正式战役存档');
  expect(html).toContain('进入所选试玩');
  expect(html).toContain('角色动作预览');
  expect(html).toContain('返回布阵');
  expect(html).not.toContain('返回正式战役');
});

test('暂停关闭文案说明返回原菜单，不自动继续', () => {
  const html = markup('combat');
  expect(html).toContain('返回暂停菜单');
  expect(html).not.toContain('返回布阵');
});

test.each(['victory', 'defeat'] as const)('%s关闭回到原结算，不误称暂停', (phase) => {
  const html = markup(phase, true);
  expect(html).toContain('返回结算');
  expect(html).not.toContain('返回暂停菜单');
  expect(html).toContain('返回正式战役');
  expect(html).toContain('无存档则按正常流程开始新局');
  expect(html).toContain('不会把试玩阵容带入正式战役');
});
