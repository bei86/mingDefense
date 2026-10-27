import type { Session } from '../game/session';
import { campaignProgress } from './campaign-progress';
import './campaign-progress.css';

type Props = {
  session: Session;
  isolated: boolean;
  onIntel: (stageId: number) => void;
  onClose: () => void;
};

export function CampaignProgress({ session, isolated, onIntel, onClose }: Props) {
  const progress = campaignProgress(session);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal campaign-progress"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-progress-title"
      >
        <div className="campaign-progress-heading">
          <div>
            <span className="eyebrow">灵林行记 · 本轮足迹</span>
            <h2 id="campaign-progress-title">战役进度</h2>
          </div>
          <button className="icon-button" aria-label="关闭战役进度" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="campaign-progress-source">
          {isolated
            ? '试玩检查点进度，不代表正式战役记录。'
            : '本轮战役进度，不包含其他轮次或浏览器记录。'}
        </p>
        <div className="campaign-progress-summary">
          <strong>
            第{progress.current.id}关 · {progress.current.name}
          </strong>
          <p>{progress.currentState}</p>
          <p>
            已守住 {progress.cleared} / {progress.total} 关 · 首领 {progress.bossesCleared} /{' '}
            {progress.bossesTotal}
          </p>
          <div
            className="campaign-progress-track"
            role="progressbar"
            aria-label="已守住关卡"
            aria-valuenow={progress.cleared}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <span style={{ width: `${(progress.cleared / progress.total) * 100}%` }} />
          </div>
        </div>
        <p>点关卡只查看敌情，不会跳关或领取奖励。“首”表示首领关。</p>
        {session.mode === 'm1' && <p>单关模式仅挑战第1关，其余关卡可预览敌情。</p>}
        {progress.chapters.map((chapter) => (
          <section
            className="campaign-progress-chapter"
            key={chapter[0].id}
            aria-label={`第${chapter[0].id}至${chapter.at(-1)!.id}关`}
          >
            <h3>
              第{chapter[0].id}—{chapter.at(-1)!.id}关
            </h3>
            <div className="campaign-progress-grid">
              {chapter.map((entry) => (
                <button
                  key={entry.id}
                  data-stage-id={entry.id}
                  data-boss={entry.boss || undefined}
                  className={entry.cleared ? 'stage-cleared' : ''}
                  aria-current={entry.current ? 'step' : undefined}
                  aria-label={`第${entry.id}关 · ${entry.name} · ${entry.current ? '当前 · ' : ''}${entry.status}${entry.boss ? ' · 首领' : ''} · 查看敌情`}
                  title={entry.name}
                  onClick={() => onIntel(entry.id)}
                >
                  <strong>
                    {entry.id}
                    {entry.boss && <span aria-hidden="true">首</span>}
                  </strong>
                  <small>{entry.current ? '当前' : entry.status}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        <button className="secondary" onClick={onClose}>
          收起战役进度
        </button>
      </section>
    </div>
  );
}
