import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { validSave } from '../game/persistence';
import finalCheckpoint from '../game/fixtures/stage-50-checkpoint.json';
import { CampaignProgress } from './CampaignProgress';

function markup(isolated = false, mode: Session['mode'] = 'campaign') {
  return renderToStaticMarkup(
    <CampaignProgress
      session={new Session(20261014, mode)}
      isolated={isolated}
      chapter={0}
      onChapter={() => {
        throw Error('渲染不得更改分段');
      }}
      onIntel={() => {
        throw Error('渲染不得查看敌情');
      }}
      onClose={() => {
        throw Error('渲染不得关闭');
      }}
    />,
  );
}

test('正式进度可查看全部50关敌情，有当前/首领标识和只读说明', () => {
  const html = markup();
  expect(html).toContain('role="dialog"');
  expect(html).toContain('本轮战役进度');
  expect(html.match(/data-stage-id=/g)).toHaveLength(50);
  expect(html.match(/data-boss="true"/g)).toHaveLength(10);
  expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  expect(html).toContain('第1关 · 林间初袭');
  expect(html).toContain('第50关 · 镇渊终战');
  expect(html).toContain('只查看敌情，不会跳关或领取奖励');
  expect(html).toContain('收起战役进度');
  expect(html).not.toContain('不代表正式战役记录');
});

test('隔离检查点来源明确，不称为正式战绩', () => {
  expect(markup(true)).toContain('试玩检查点进度，不代表正式战役记录');
});

test('历史单关模式说明其他关卡只可预览', () => {
  expect(markup(false, 'm1')).toContain('单关模式仅挑战第1关，其余关卡可预览敌情');
});

test.each([
  { chapter: 5, first: 41, last: 50, count: 10, current: 1 },
  { chapter: 1, first: 1, last: 10, count: 10, current: 0 },
  { chapter: 0, first: 1, last: 50, count: 50, current: 1 },
])('真实终战开局显示分段$chapter，统计和当前关不受筛选影响', (view) => {
  if (!validSave(finalCheckpoint)) throw new Error('终战检查点无效');
  const session = Session.restore(finalCheckpoint);
  const before = JSON.stringify(session.exportSave());
  const html = renderToStaticMarkup(
    <CampaignProgress
      session={session}
      isolated
      chapter={view.chapter}
      onChapter={() => {
        throw Error('渲染不得更改分段');
      }}
      onIntel={() => {
        throw Error('渲染不得打开敌情');
      }}
      onClose={() => {
        throw Error('渲染不得关闭');
      }}
    />,
  );
  expect(html.match(/data-stage-id=/g)).toHaveLength(view.count);
  expect(html.match(/aria-current="step"/g) ?? []).toHaveLength(view.current);
  expect(html).toContain(`data-stage-id="${view.first}"`);
  expect(html).toContain(`data-stage-id="${view.last}"`);
  expect(html).toContain(`<option value="${view.chapter}" selected="">`);
  expect(html).toContain('（当前）');
  expect(html).toContain('已守住 49 / 50 关');
  expect(html).toContain('首领 9 / 10');
  expect(html).toContain('第50关 · 镇渊终战');
  expect(html).toContain('试玩检查点进度，不代表正式战役记录');
  expect(JSON.stringify(session.exportSave())).toBe(before);
});
