import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { DisplaySettings } from './DisplaySettings';

function markup(overrides: Partial<Parameters<typeof DisplaySettings>[0]> = {}) {
  return renderToStaticMarkup(
    <DisplaySettings
      options={{ numbers: true, motion: 'system' }}
      systemReduced={false}
      isolated={false}
      saved
      paused={false}
      onChange={() => {}}
      onClose={() => {}}
      {...overrides}
    />,
  );
}

test('默认设置有可访问标签、准确选中值及战斗显示边界', () => {
  const html = markup();
  expect(html).toContain('role="dialog"');
  expect(html).toContain('伤害飘字');
  expect(html).toContain('checked=""');
  expect(html).toContain('for="display-motion"');
  expect(html).toContain('<option value="system" selected="">');
  expect(html).toContain('技能轨迹与危险预警保留');
  expect(html).toContain('返回布阵');
  expect(html).not.toContain('系统已开启');
});

test('暂停与隔离试玩提示不承诺自动恢复战斗或保存正式偏好', () => {
  const html = markup({
    options: { numbers: false, motion: 'reduced' },
    paused: true,
    isolated: true,
  });
  expect(html).not.toContain('checked=""');
  expect(html).toContain('<option value="reduced" selected="">');
  expect(html).toContain('返回暂停菜单');
  expect(html).toContain('刷新恢复默认');
  expect(html).not.toContain('新局保留');
});

test('系统减少动态和存储故障分别明确说明', () => {
  const html = markup({ systemReduced: true, saved: false });
  expect(html).toContain('系统已开启减少动态，始终按减少动态显示');
  expect(html).toContain('本页已生效，但浏览器未能记住');
});
