import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Session } from '../game/session';
import { TalentCatalogue } from './TalentCatalogue';

test('全部天赋包含未获得的13项、前置及生效边界，没有选择天赋按钮', () => {
  const session = new Session();
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(<TalentCatalogue session={session} />);
  expect(html).toContain('aria-label="全部天赋"');
  expect(html.match(/class="journal-entry"/g)).toHaveLength(13);
  expect(html).toContain('全部13道 · 满足入池条件6道');
  expect(html).toContain('终烬');
  expect(html).toContain('先获得「追烬」');
  expect(html).toContain('第6关起');
  expect(html).toContain('3阶起，备战不计');
  expect(html).toContain('不保证下一次出现');
  expect(html).toContain('倒下的上阵灵兽仍计入前置');
  expect(html).not.toContain('<button');
  expect(JSON.stringify(session)).toBe(before);
});

test('已满层状态区别未满足前置，并显示本场实际层数', () => {
  const session = new Session();
  session.preparation.progression.buffs = { attack: 10 };
  const html = renderToStaticMarkup(<TalentCatalogue session={session} />);
  expect(html).toContain('已满层，不再入池');
  expect(html).toContain('10/10 层');
  expect(html).toContain('尚缺：');
  expect(html).toContain('生效说明');
});
