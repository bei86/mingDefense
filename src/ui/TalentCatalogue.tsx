import { buffDefinitions, buffLabels } from '../game/progression';
import type { Session } from '../game/session';
import { buffArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { talentCatalogue, type TalentCatalogueEntry } from './talent-catalogue';

function poolLabel(entry: TalentCatalogueEntry): string {
  if (entry.maxed) return '已满层，不再入池';
  if (entry.eligible) return '满足入池条件';
  return `尚缺：${entry.blockers.join('；')}`;
}

export function TalentCatalogue({ session }: { session: Session }) {
  const entries = talentCatalogue(session);
  return (
    <>
      <p className="journal-hint">
        {`全部${entries.length}道 · 满足入池条件${entries.filter((entry) => entry.eligible).length}道`}
      </p>
      <p className="journal-hint">
        按当前关卡、上阵记录及已获天赋检查，不保证下一次出现，也不表示已提供候选。备战不计；本关倒下的上阵灵兽仍计入前置，实际施放需存活。失败或退出后本关成长回滚。
      </p>
      <div className="journal-list" role="list" aria-label="全部天赋">
        {entries.map((entry) => (
          <article key={entry.id} className="journal-entry" role="listitem">
            <div className="journal-heading">
              <strong>
                <ArtImage asset={buffArt[entry.id]} /> {buffLabels[entry.id].name}
              </strong>
              <span className="journal-level">{`${entry.level}/${entry.maxLevel} 层`}</span>
            </div>
            <p>
              {buffDefinitions[entry.id].quality === 'common' ? '通用' : '专属'} · 每层：
              {buffLabels[entry.id].description}
            </p>
            <dl>
              <div>
                <dt>入池前置</dt>
                <dd>{entry.requirements.join('；') || '无额外前置条件'}</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd className={entry.eligible ? 'journal-contribution' : ''}>{poolLabel(entry)}</dd>
              </div>
              <div>
                <dt>生效说明</dt>
                <dd>{entry.note}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
