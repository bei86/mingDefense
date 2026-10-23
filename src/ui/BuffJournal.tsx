import { buffDefinitions, buffLabels } from '../game/progression';
import type { Session } from '../game/session';
import { buffArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { talentJournal } from './talent-journal';
import './talent-journal.css';

export function BuffJournal({ session, onClose }: { session: Session; onClose: () => void }) {
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
        {entries.length ? (
          <p className="journal-hint">
            累计仅为本天赋贡献，实际效果受技能、上限与战场条件影响。
            {session.battle ? '人数按本关当前存活统计。' : '人数按当前布阵统计，备战灵兽需上阵。'}
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
        <button className="primary" onClick={onClose}>
          收起手札
        </button>
      </section>
    </div>
  );
}
