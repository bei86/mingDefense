import { useState } from 'react';
import { buffDefinitions, buffLabels } from '../game/progression';
import type { Session } from '../game/session';
import { buffArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { talentJournal } from './talent-journal';
import { TalentCatalogue } from './TalentCatalogue';
import './talent-journal.css';

export function BuffJournal({
  session,
  onClose,
  closeLabel = '收起手札',
}: {
  session: Session;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [view, setView] = useState<'acquired' | 'all'>('acquired');
  const entries = talentJournal(session);
  const total = entries.reduce((sum, entry) => sum + entry.level, 0);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal help-modal talent-journal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buff-title"
      >
        <span className="eyebrow">
          本轮修行 · {entries.length} 道 / {total} 层
        </span>
        <div className="journal-title">
          <h2 id="buff-title">天赋手札</h2>
          <button className="icon-button" aria-label="关闭天赋手札" onClick={onClose}>
            ×
          </button>
        </div>
        {session.phase === 'defeat' && (
          <p className="journal-hint">
            本关失败，以下为本场结束时的修行；重试或返回布阵后，本关成长会回滚。
          </p>
        )}
        <div className="journal-views" role="group" aria-label="手札查看方式">
          <button aria-pressed={view === 'acquired'} onClick={() => setView('acquired')}>
            已获得
          </button>
          <button aria-pressed={view === 'all'} onClick={() => setView('all')}>
            全部天赋
          </button>
        </div>
        {view === 'all' ? (
          <TalentCatalogue session={session} />
        ) : (
          <>
            {entries.length ? (
              <p className="journal-hint">
                累计仅为本天赋贡献，实际效果受技能、上限与战场条件影响。
                {session.battle
                  ? '人数按本关当前存活统计。'
                  : '人数按当前布阵统计，备战灵兽需上阵。'}
              </p>
            ) : (
              <p>击败敌人积累经验，升级后选择天赋。</p>
            )}
            <div className="journal-list">
              {entries.map((entry) => (
                <article key={entry.id} className="journal-entry">
                  <div className="journal-heading">
                    <strong>
                      <ArtImage asset={buffArt[entry.id]} /> {buffLabels[entry.id].name}
                    </strong>
                    <span className="journal-level">
                      {entry.level}/{entry.maxLevel} 层
                      {entry.level >= entry.maxLevel ? ' · 已满层' : ''}
                    </span>
                  </div>
                  <p>
                    {buffDefinitions[entry.id].quality === 'common' ? '通用' : '专属'} · 每层：
                    {buffLabels[entry.id].description}
                  </p>
                  <dl>
                    <div>
                      <dt>当前累计</dt>
                      <dd className="journal-contribution">{entry.contribution}</dd>
                    </div>
                    <div>
                      <dt>适用范围</dt>
                      <dd>{entry.scope}</dd>
                    </div>
                    <div>
                      <dt>生效条件</dt>
                      <dd>{entry.note}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
        <button className="primary" onClick={onClose}>
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
