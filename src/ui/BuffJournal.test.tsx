import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { BuffJournal } from './BuffJournal';

test('手札默认已获得、保留空指引，全部模式不会伪装成已拥有', () => {
  const html = renderToStaticMarkup(<BuffJournal session={new Session()} onClose={() => {}} />);
  expect(html).toContain('aria-label="手札查看方式"');
  expect(html).toContain('aria-pressed="true">已获得');
  expect(html).toContain('aria-pressed="false">全部天赋');
  expect(html).toContain('击败敌人积累经验');
  expect(html).not.toContain('终烬');
  expect(html).toContain('本轮修行 · 0 道 / 0 层');
});

test('默认已获摘要与累计保持，不把未获得加入现有手札', () => {
  const session = new Session();
  session.preparation.progression.buffs = { range: 2 };
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(<BuffJournal session={session} onClose={() => {}} />);
  expect(html).toContain('本轮修行 · 1 道 / 2 层');
  expect(html).toContain('远瞩');
  expect(html).toContain('+0.4 格');
  expect(html).not.toContain('终烬');
  expect(JSON.stringify(session)).toBe(before);
});
