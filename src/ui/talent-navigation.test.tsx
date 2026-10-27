import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { BuffJournal } from './BuffJournal';
import { ResultModal, TalentModal } from './CampaignPanels';
import { temporaryReportStorage } from './report-collection';

const noop = () => {};

test.each(['combat', 'victory'] as const)(
  '多次待选的%s界面提供手札，查看保留全部候选和本场成长',
  (phase) => {
    const session = rosterPlaytest();
    session.start();
    session.phase = phase;
    session.battle!.choices = ['range', 'attack'];
    session.battle!.pendingChoices = 2;
    session.battle!.progression.buffs = { range: 2 };
    const before = JSON.stringify(session);
    const choice = renderToStaticMarkup(
      <TalentModal session={session} onChoose={noop} onBuffs={noop} />,
    );
    expect(choice).toContain('查看天赋手札');
    expect(choice).toContain('还有 2 次选择');
    const journal = renderToStaticMarkup(
      <BuffJournal session={session} onClose={noop} closeLabel="返回天赋选择" />,
    );
    expect(journal).toContain('返回天赋选择');
    expect(journal).toContain('本轮修行 · 1 道 / 2 层');
    expect(JSON.stringify(session)).toBe(before);
  },
);

test.each(['victory', 'defeat', 'complete', 'trial'] as const)(
  '%s结算提供手札并保留原操作',
  (kind) => {
    const session = rosterPlaytest();
    session.start();
    session.phase = kind === 'defeat' ? 'defeat' : 'victory';
    session.settled = true;
    if (kind === 'complete') session.preparation.stageId = 50;
    const before = JSON.stringify(session);
    const html = renderToStaticMarkup(
      <ResultModal
        session={session}
        isolated
        reportStorage={temporaryReportStorage()}
        onReports={noop}
        onSaves={noop}
        onNext={noop}
        onRetry={noop}
        onPrepare={noop}
        onReset={noop}
        onBuffs={noop}
        trialActions={kind === 'trial' ? <button>重置本方案</button> : undefined}
      />,
    );
    expect(html).toContain('>天赋手札</button>');
    expect(html).toContain('战报收藏');
    expect(html).toContain(
      { victory: '前往第', defeat: '免费重试', complete: '五十境皆安', trial: '重置本方案' }[kind],
    );
    expect(JSON.stringify(session)).toBe(before);
  },
);

test('败局手札显示本场成长与回滚说明，普通整备不显示失败说明', () => {
  const session = rosterPlaytest();
  session.start();
  session.phase = 'defeat';
  session.battle!.progression.buffs = { range: 2 };
  const before = JSON.stringify(session);
  const html = renderToStaticMarkup(
    <BuffJournal session={session} onClose={noop} closeLabel="返回本关结算" />,
  );
  expect(html).toContain('返回本关结算');
  expect(html).toContain('本轮修行 · 1 道 / 2 层');
  expect(html).toContain('重试或返回布阵后，本关成长会回滚');
  expect(JSON.stringify(session)).toBe(before);
  const preparation = renderToStaticMarkup(
    <BuffJournal session={rosterPlaytest()} onClose={noop} />,
  );
  expect(preparation).toContain('收起手札');
  expect(preparation).not.toContain('本关失败');
});
