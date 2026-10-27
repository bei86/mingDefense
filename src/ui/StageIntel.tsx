import type { Spawn } from '../game/combat-model';
import { useState } from 'react';
import { stages, stageNames } from '../game/content';
import { bossArtKey, enemyArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { timeLabel } from './CampaignPanels';
import { stageIntel, type EnemyIntelEntry } from './stage-intel';

function EnemyCard({ entry, stageId }: { entry: EnemyIntelEntry; stageId: number }) {
  const asset = entry.kind === 'boss' ? bossArtKey(stageId) : enemyArt[entry.kind];
  const stats = [
    ['生命', entry.hp],
    ['基础普攻', entry.damage],
    ['动作间隔', `${entry.intervalMs / 1000} 秒`],
    ['射程', `${entry.range} 格`],
    ['移动速度', `${entry.speed} 格/秒`],
    ['击杀所得', `${entry.xp} 经验 · ${entry.energy} 灵气`],
  ];
  return (
    <article className="intel-enemy">
      <div className="handbook-profile">
        {asset ? (
          <ArtImage key={asset} asset={asset} />
        ) : (
          <span className="intel-emblem" aria-hidden="true">
            首
          </span>
        )}
        <div>
          <h4>{entry.name}</h4>
          <p>
            {entry.count > 0
              ? `固定 ${entry.count} 只 · ${timeLabel(entry.firstAt!)}–${timeLabel(entry.lastAt!)}`
              : '技能生成 · 数量随战况变化'}
          </p>
        </div>
      </div>
      <dl className="handbook-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {entry.skills.map((skill) => (
        <p className="intel-rule" key={skill}>
          {skill}
        </p>
      ))}
    </article>
  );
}

export function StageIntel({
  currentStageId,
  currentSpawns,
  initialStageId,
  closeLabel = '收起敌情手册',
  onClose,
}: {
  currentStageId: number;
  currentSpawns?: readonly Spawn[];
  initialStageId?: number;
  closeLabel?: string;
  onClose: () => void;
}) {
  const [stageId, setStageId] = useState(initialStageId ?? currentStageId);
  const intel = stageIntel(stageId, stageId === currentStageId ? currentSpawns : undefined);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal handbook-modal intel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intel-title"
      >
        <div className="handbook-heading">
          <div>
            <span className="eyebrow">守阵手札 · 敌情篇</span>
            <h2 id="intel-title">关卡敌情手册</h2>
          </div>
          <button className="icon-button" aria-label="关闭敌情手册" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="handbook-note">
          当前原型临时数值（P），待原作实机校准。浏览不会跳关或改变存档。
        </p>
        <nav className="intel-navigation" aria-label="浏览关卡">
          <button
            aria-label="上一关敌情"
            disabled={stageId === 1}
            onClick={() => setStageId(stageId - 1)}
          >
            ‹
          </button>
          <label>
            <span className="intel-select-label">选择关卡</span>
            <select
              aria-label="选择敌情关卡"
              value={stageId}
              onChange={(event) => setStageId(Number(event.target.value))}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  第{stage.id}关 · {stageNames[stage.id - 1]}
                  {stage.bossId ? ' · 首领' : ''}
                  {stage.id === currentStageId ? '（当前）' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="下一关敌情"
            disabled={stageId === stages.length}
            onClick={() => setStageId(stageId + 1)}
          >
            ›
          </button>
        </nav>
        <div className="intel-summary" aria-live="polite" aria-atomic="true">
          <span className="eyebrow">{stageId === currentStageId ? '当前关卡' : '关卡预览'}</span>
          <h3>
            第 {stageId} 关 · {intel.name}
          </h3>
          <p>
            固定出场 {intel.total} 只 · 最后出场 {timeLabel(intel.lastSpawnAt)}
          </p>
          <p>通关基础奖励 {intel.reward} 灵钱</p>
        </div>
        <p className="handbook-note">
          固定数量不含召唤与分裂，最后出场时间不代表战斗结束。基础普攻为单次值，未计狂暴及受击方减伤，技能另算。
        </p>
        <h3 className="intel-section-title">波次时间表</h3>
        <ol className="intel-waves" aria-label="波次时间表">
          {intel.waves.map((wave) => (
            <li key={wave.index}>
              <div className="intel-wave-heading">
                <h4>{`第${wave.index}波时段`}</h4>
                <span>{`固定 ${wave.total} 只`}</span>
              </div>
              <p>{`起点 ${timeLabel(wave.startAt)}`}</p>
              {wave.total > 0 ? (
                <>
                  <p>{`首末出场 ${timeLabel(wave.firstAt!)}–${timeLabel(wave.lastAt!)}`}</p>
                  <ul aria-label={`第${wave.index}波敌人构成`}>
                    {wave.counts.map((entry) => (
                      <li key={entry.kind}>{`${entry.name} × ${entry.count}`}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>本时段无固定出场</p>
              )}
            </li>
          ))}
        </ol>
        <p className="handbook-note">
          按各波起点划分时段，时间为开战后的游戏内计划时间；出怪不等待前一波清完，不代表抵达阵线或清场时间。召唤与分裂不计入固定数量。
        </p>
        <h3 className="intel-section-title">敌人属性</h3>
        {intel.enemies.map((entry) => (
          <EnemyCard key={entry.kind} entry={entry} stageId={stageId} />
        ))}
        {intel.derived.length > 0 && (
          <>
            <h3 className="intel-section-title">召唤与分裂</h3>
            {intel.derived.map((entry) => (
              <EnemyCard key={entry.kind} entry={entry} stageId={stageId} />
            ))}
          </>
        )}
        <p className="handbook-note">
          敌人先清前排，同排先低阶，再按仇恨选目标；远程敌人也遵守这一规则。间隔为配置基础值，实战受冻结、首领二阶段及固定步长影响。
        </p>
        <button className="secondary" onClick={onClose}>
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
