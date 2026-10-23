import { buffDefinitions, buffLabels, threshold } from '../game/progression';
import { stageNames } from '../game/content';
import type { BuffId } from '../game/model';
import type { Session } from '../game/session';
import type { StoragePort } from '../game/persistence';
import { BattleReport } from './BattleReport';
import { buffArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { DefeatAdvice } from './DefeatAdvice';
import { defeatRecap } from './defeat-advice';
import { ReportExport } from './ReportExport';
import { talentPreview } from './talent-preview';
import { TalentPreview } from './TalentPreview';

export function timeLabel(ms: number): string {
  return `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`;
}
export function ExperienceBar({
  session,
  onShowBuffs,
}: {
  session: Session;
  onShowBuffs: () => void;
}) {
  const p = session.battle?.progression ?? session.preparation.progression;
  const total = Object.values(p.buffs).reduce((n, value) => n + value, 0);
  return (
    <section className="experience">
      <span>
        修行 <b>Lv.{p.level}</b>
      </span>
      <div
        className="xp-track"
        role="progressbar"
        aria-label="修行经验"
        aria-valuenow={p.xp}
        aria-valuemax={threshold(p.level)}
      >
        <div style={{ width: `${(p.xp / threshold(p.level)) * 100}%` }} />
      </div>
      <small>
        {p.xp}/{threshold(p.level)}
      </small>
      <button onClick={onShowBuffs}>天赋 {total} ›</button>
    </section>
  );
}
export function TalentModal({
  session,
  onChoose,
}: {
  session: Session;
  onChoose: (id: BuffId) => void;
}) {
  const b = session.battle!;
  return (
    <div className="modal-backdrop talent-backdrop">
      <section
        className="modal talent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="talent-title"
      >
        <span className="eyebrow">灵感初生 · 战场已暂停</span>
        <h2 id="talent-title">择一道天赋</h2>
        <p>
          修行 Lv.{b.progression.level} ·{' '}
          {b.pendingChoices > 1 ? `还有 ${b.pendingChoices} 次选择` : '选后继续守阵'}
          <br />
          本关失败或退出时，本关成长会回滚。
        </p>
        <div className="talent-options">
          {b.choices.map((id) => {
            const definition = buffDefinitions[id];
            const label = buffLabels[id];
            const preview = talentPreview(b, id);
            return (
              <button
                key={id}
                className={`talent-card ${definition.quality}`}
                onClick={() => onChoose(id)}
              >
                <span className="talent-symbol">
                  <ArtImage asset={buffArt[id]} />
                </span>
                <span>
                  <small>
                    {definition.quality === 'common' ? '通用' : '专属'} ·{' '}
                    {b.progression.buffs[id] ?? 0} →{' '}
                    {preview?.nextLevel ?? (b.progression.buffs[id] ?? 0) + 1}/{definition.maxLevel}{' '}
                    层
                  </small>
                  <strong>{label.name}</strong>
                  <span>{label.description}</span>
                  {preview && <TalentPreview preview={preview} />}
                </span>
                <b>＋</b>
              </button>
            );
          })}
        </div>
        <p className="talent-preview-hint">
          累计仅表示本天赋贡献，实际效果受技能、上限与战场条件影响。
        </p>
      </section>
    </div>
  );
}
export function ResultModal({
  session,
  isolated,
  reportStorage,
  onReports,
  onSaves,
  onNext,
  onRetry,
  onPrepare,
  onReset,
}: {
  session: Session;
  isolated: boolean;
  reportStorage: StoragePort;
  onReports: () => void;
  onSaves: () => void;
  onNext: () => void;
  onRetry: () => void;
  onPrepare: () => void;
  onReset: () => void;
}) {
  const win = session.phase === 'victory';
  const b = session.battle!;
  return (
    <div className="modal-backdrop">
      <section
        className="modal result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <span className="result-emblem">{win ? '✦' : '◇'}</span>
        <span className="eyebrow">
          {stageNames[session.preparation.stageId - 1]} · 第 {session.preparation.stageId} 关
        </span>
        <h2 id="result-title">{session.complete ? '五十境皆安' : win ? '灵林无恙' : '阵线失守'}</h2>
        <p>
          {session.complete
            ? '五十关挑战已完成，感谢守护这一片灵林。可重新开始挑战；当前数值仍待原作实机校准。'
            : win
              ? '成长和阵容保留，进入下关时全员恢复，并免费刷新招募。'
              : '免费重试会恢复开战前的阵容、招募与修行，本关临时收益不保留。'}
        </p>
        <div className="result-stats">
          <span>
            击退<strong>{b.kills}</strong>
          </span>
          <span>
            用时<strong>{timeLabel(b.time)}</strong>
          </span>
          <span>
            剩余生命<strong>{session.totalHealth()}</strong>
          </span>
        </div>
        {win && (
          <div className="reward">
            本关收入 <b>◈ {session.lastReward + session.lastIncome + session.lastBonus}</b>
            <small>
              通关 {session.lastReward} · 产钱/转化 {session.lastIncome} · 天赋 {session.lastBonus}
            </small>
          </div>
        )}
        <div className="battle-totals">
          <span>造成伤害 {Math.floor(b.damageDone)}</span>
          <span>承受伤害 {Math.floor(b.damageTaken)}</span>
          <span>击杀经验 {b.xpEarned}</span>
        </div>
        <BattleReport battle={b} />
        <ReportExport session={session} isolated={isolated} storage={reportStorage} />
        {!win && <DefeatAdvice session={session} recap={defeatRecap(b)} />}
        {win && !session.complete && (
          <button className="primary" onClick={onNext}>
            前往第 {session.preparation.stageId + 1} 关整备 →
          </button>
        )}
        {!win && (
          <>
            <button className="primary" onClick={onRetry}>
              免费重试
            </button>
            <button className="secondary" onClick={onPrepare}>
              返回调整阵容
            </button>
          </>
        )}
        <button className="secondary" onClick={onReports}>
          战报收藏
        </button>
        <button className="secondary" onClick={onSaves}>
          存档备份与恢复
        </button>
        <button className={session.complete ? 'primary' : 'text-button'} onClick={onReset}>
          重新开始五十关挑战
        </button>
      </section>
    </div>
  );
}
