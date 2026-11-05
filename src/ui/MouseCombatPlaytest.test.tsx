import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { mouseCombatPlaytest } from '../game/fixtures/mouse-combat-playtest';
import { ResultModal } from './CampaignPanels';
import { MouseCombatPlaytest } from './MouseCombatPlaytest';
import { temporaryReportStorage } from './report-collection';

test('说明默认折叠、不遮战场，提供干净的嵌套路径导航', () => {
  const html = renderToStaticMarkup(<MouseCombatPlaytest pathname="/game/" />);
  expect(html).toContain('烬灵鼠 · 实战动作对照');
  expect(html).not.toContain('open=""');
  expect(html).toContain('人工固定阵容');
  expect(html).toContain('不代表正常经济路线');
  expect(html).toContain('场景使用第1关敌群');
  expect(html).toContain('href="/game/?playtest=mouse-combat"');
  expect(html).toContain('href="/game/?preview=mouse-motion"');
  expect(html).toContain('href="/game/"');
  expect(html).toContain('减少动态');
});

test.each(['victory', 'defeat'] as const)(
  '%s样板结算显示重置与返回，正常战役仍有推进/重试',
  (phase) => {
    const session = mouseCombatPlaytest();
    session.start();
    session.phase = phase;
    const noop = () => {};
    const props = {
      session,
      isolated: true,
      reportStorage: temporaryReportStorage(),
      onReports: noop,
      onSaves: noop,
      onNext: noop,
      onRetry: noop,
      onPrepare: noop,
      onReset: noop,
    };
    const html = renderToStaticMarkup(
      <ResultModal {...props} trialActions={<MouseCombatPlaytest pathname="/game/" result />} />,
    );
    expect(html).toContain('open=""');
    expect(html).toContain('重置动作样板');
    expect(html).toContain('返回正式战役');
    expect(html).not.toContain('前往第');
    expect(html).not.toContain('免费重试');
    expect(html).not.toContain('重新开始五十关挑战');
    const campaign = renderToStaticMarkup(<ResultModal {...props} />);
    expect(campaign).toContain(phase === 'victory' ? '前往第' : '免费重试');
  },
);
