import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RendererRecoveryDialog } from './RendererRecovery';

it('正常战斗的重载操作明确提示开战检查点和收益回滚，没有继续战斗入口', () => {
  const html = renderToStaticMarkup(
    createElement(RendererRecoveryDialog, { state: 'lost', phase: 'combat', isolated: false }),
  );
  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-describedby="renderer-recovery-description"');
  expect(html).toContain('本关未结算的灵钱、经验和天赋不保留');
  expect(html).toContain('重新加载，回到布阵');
  expect(html).not.toContain('继续守卫');
});

it('隔离试玩不承诺恢复正式存档或临时进度', () => {
  const html = renderToStaticMarkup(
    createElement(RendererRecoveryDialog, { state: 'lost', phase: 'combat', isolated: true }),
  );
  expect(html).toContain('重新加载会重置临时试玩进度');
  expect(html).toContain('不影响正式存档');
  expect(html).not.toContain('回到开战前布阵');
});

it('整备与结算使用对应的恢复说明，等待首帧时仍明确维持暂停', () => {
  const preparation = renderToStaticMarkup(
    createElement(RendererRecoveryDialog, { state: 'lost', phase: 'prepare', isolated: false }),
  );
  expect(preparation).toContain('恢复最近保存的布阵');
  for (const phase of ['victory', 'defeat'] as const) {
    const result = renderToStaticMarkup(
      createElement(RendererRecoveryDialog, { state: 'restoring', phase, isolated: false }),
    );
    expect(result).toContain('恢复最近保存的关卡进度');
    expect(result).toContain('守卫仍保持暂停');
    expect(result).not.toContain('本关未结算');
  }
});
