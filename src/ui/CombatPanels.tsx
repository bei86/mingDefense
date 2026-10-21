import {
  bossDescription,
  bossName,
  config,
  enemyAppearances,
  stageNames,
  stages,
} from '../game/content';
import type { Session } from '../game/session';
import { ArtImage } from './ArtImage';
import { timeLabel } from './CampaignPanels';

export function EnemyIntel({ stageId }: { stageId: number }) {
  const stage = stages[stageId - 1];
  return (
    <details className="enemy-intel" key={stageId}>
      <summary>本关敌情 · {stage.bossId ? bossName(stageId) : '查看敌人特性'}</summary>
      <ul>
        {[...new Set(stage.waves.flatMap((w) => Object.keys(w.enemies)))].map((id) => (
          <li key={id}>
            <strong>{enemyAppearances[id as keyof typeof enemyAppearances].name}</strong>：
            {enemyAppearances[id as keyof typeof enemyAppearances].description}
          </li>
        ))}
      </ul>
      {stage.bossId && <p>{bossDescription(stageId)}</p>}
    </details>
  );
}

export function CombatHeader({ session, onPause }: { session: Session; onPause: () => void }) {
  let status = '守卫中';
  if (session.hasChoices) status = '择取天赋';
  else if (session.phase === 'victory') status = '已守住';
  else if (session.phase === 'defeat') status = '阵线失守';
  else if (session.paused) status = '已暂停';
  return (
    <header className="combat-header">
      <div>
        <span className="combat-kicker">
          第 {session.preparation.stageId} / {stages.length} 关 · {status}
        </span>
        <h1 className="combat-heading" tabIndex={-1}>
          {stageNames[session.preparation.stageId - 1]}
        </h1>
      </div>
      <button
        className="combat-menu-button"
        aria-label="暂停守卫"
        disabled={session.phase !== 'combat' || session.hasChoices}
        onClick={onPause}
      >
        <span aria-hidden="true">Ⅱ</span> 暂停
      </button>
    </header>
  );
}

export function CombatStatus({ session }: { session: Session }) {
  const b = session.battle!;
  const maxHp = b.allies.reduce((n, u) => n + u.maxHp, 0);
  const hp = session.totalHealth();
  const remaining = Math.max(0, config.runtime.stageLimitMs - b.time);
  const wave = session.stage.waves.filter((w) => b.time >= w.atMs).length;
  const boss = b.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
  return (
    <section className="combat-status" aria-label="守卫状态">
      <div className="combat-vitals">
        <div className="combat-health">
          <div>
            <span>阵容生命</span>
            <strong>
              {hp}
              <small> / {maxHp}</small>
            </strong>
          </div>
          <div
            className="health-track"
            role="progressbar"
            aria-label="阵容生命"
            aria-valuenow={hp}
            aria-valuemin={0}
            aria-valuemax={maxHp}
          >
            <span style={{ width: `${maxHp ? Math.min(100, (hp / maxHp) * 100) : 0}%` }} />
          </div>
        </div>
        <div className={`combat-timer ${remaining <= 30000 ? 'urgent' : ''}`}>
          <small>剩余时间</small>
          <strong>{timeLabel(Math.ceil(remaining / 1000) * 1000)}</strong>
        </div>
      </div>
      <div className="combat-wave">
        <span>
          波次{' '}
          <b>
            {wave} / {session.stage.waves.length}
          </b>
        </span>
        <span>
          已出 {b.spawnIndex} / {b.spawns.length}
        </span>
        <span>
          击退 <b>{b.kills}</b>
        </span>
      </div>
      {boss && (
        <div className={`combat-boss ${boss.phase2 ? 'enraged' : ''}`}>
          <div>
            <strong>
              {bossName(b.stageId)}
              {boss.phase2 ? ' · 怒意苏醒' : ''}
            </strong>
            <small>
              {Math.ceil(boss.hp)} / {boss.maxHp}
            </small>
          </div>
          <div className="boss-track">
            <span style={{ width: `${(boss.hp / boss.maxHp!) * 100}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

export function CombatControls({ session, onSpeed }: { session: Session; onSpeed: () => void }) {
  const b = session.battle!;
  const boosted = b.boosted && session.canAdvance;
  const release = () => {
    session.held = false;
  };
  return (
    <>
      <div className="combat-energy">
        <span>
          聚灵{' '}
          <b>
            {Math.floor(b.energy)}
            <small> / 100</small>
          </b>
        </span>
        <span>击杀回灵 · 按住提升攻速</span>
      </div>
      <div className="energy-bar">
        <div style={{ width: `${b.energy}%` }} />
      </div>
      <div className="combat-buttons">
        <button
          className={`energy-button ${boosted ? 'charging' : ''}`}
          disabled={!session.canAdvance}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            session.held = true;
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={(e) => {
            if ([' ', 'Enter'].includes(e.key)) {
              e.preventDefault();
              session.held = true;
            }
          }}
          onKeyUp={release}
          onBlur={release}
        >
          <span className="stone">
            <ArtImage asset="icon_boost" />
          </span>
          <span>
            <strong>{boosted ? '灵气流转' : '按住聚灵'}</strong>
            <small>灵兽攻速 +50%</small>
          </span>
          <span aria-hidden="true">✦</span>
        </button>
        <button
          className="combat-speed"
          disabled={session.phase !== 'combat' || session.hasChoices}
          onClick={onSpeed}
          aria-label={`切换速度，当前${session.speed}倍`}
        >
          <strong>{session.speed}×</strong>
          <span>倍速</span>
        </button>
      </div>
    </>
  );
}

type PauseProps = {
  session: Session;
  onResume: () => void;
  onPrepare: () => void;
  onHelp: () => void;
  onBuffs: () => void;
  onReset: () => void;
};
export function PauseMenu({ session, onResume, onPrepare, onHelp, onBuffs, onReset }: PauseProps) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal pause-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <span className="eyebrow">{stageNames[session.preparation.stageId - 1]} · 战场已暂停</span>
        <h2 id="pause-title">暂歇片刻</h2>
        <p>继续后重新按住聚灵石。</p>
        <button className="primary" onClick={onResume}>
          继续守卫
        </button>
        <div className="pause-tools">
          <button className="secondary" onClick={onBuffs}>
            天赋手札
          </button>
          <button className="secondary" onClick={onHelp}>
            玩法说明
          </button>
        </div>
        <EnemyIntel stageId={session.preparation.stageId} />
        <p className="pause-income">
          灵钱 {session.preparation.currency} · 本关待结 {session.battle!.income}
        </p>
        <button className="secondary" onClick={onPrepare}>
          返回调整阵容
        </button>
        <button className="text-button" onClick={onReset}>
          重新开始挑战
        </button>
      </section>
    </div>
  );
}
