import { appearances } from '../game/content';
import { bossArtKey, enemyArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { EnemyWarnings } from './EnemyWarnings';
import { EnemyAttack } from './EnemyAttack';
import type { InspectedEnemy, EnemyInspectionView } from './enemy-inspection';
import type { BossWarningTarget } from './boss-warnings';
import './inspection-links.css';

function targetLabel(enemy: InspectedEnemy): string {
  const target = enemy.target;
  if (target) {
    return `${appearances[target.kind].name} · ${target.rank}阶 · ${target.position.x + 1}列${target.position.y + 1}行`;
  }
  return enemy.targetState === 'lost' ? '原目标已倒下或未记录，等待重新寻敌' : '尚未锁定灵兽';
}

function EnemyDetails({
  enemy,
  stageId,
  onTarget,
  initialWarning,
}: {
  enemy: InspectedEnemy;
  stageId: number;
  onTarget: (id: number) => void;
  initialWarning?: BossWarningTarget;
}) {
  const target = enemy.target;
  const art =
    enemy.kind === 'boss' ? bossArtKey(stageId, enemy.phase === '第二阶段') : enemyArt[enemy.kind];
  return (
    <article className="inspection-unit inspection-enemy">
      {initialWarning && (
        <>
          <p className="inspection-note">
            预警定位 · 第{initialWarning.row}行 · {initialWarning.echo ? '追击' : '横扫'}
          </p>
          <EnemyWarnings
            key={enemy.id}
            warnings={enemy.warnings}
            onSelect={onTarget}
            initialWarning={initialWarning}
          />
        </>
      )}
      <div className="inspection-profile">
        {art && <ArtImage key={art} asset={art} />}
        <div>
          <h3>
            {enemy.name} <small>#{enemy.id}</small>
          </h3>
          <p>{enemy.phase ?? '普通敌人'} · 当前存活</p>
        </div>
      </div>
      <div className="inspection-health">
        <span>生命</span>
        <strong>
          {enemy.hp} / {enemy.maxHp ?? '上限未记录'}
        </strong>
      </div>
      {enemy.maxHp !== null && (
        <div
          className="health-track"
          role="progressbar"
          aria-label="所选敌人生命"
          aria-valuenow={enemy.hp}
          aria-valuemin={0}
          aria-valuemax={enemy.maxHp}
        >
          <span style={{ width: `${Math.min(100, (enemy.hp / enemy.maxHp) * 100)}%` }} />
        </div>
      )}
      <dl className="enemy-state">
        <div>
          <dt>当前锁定</dt>
          <dd>
            {targetLabel(enemy)}
            {target && (
              <button
                type="button"
                className="secondary inspection-link"
                aria-label={`查看锁定灵兽：${appearances[target.kind].name}${target.rank}阶，${target.position.x + 1}列${target.position.y + 1}行`}
                onClick={() => onTarget(target.id)}
              >
                查看锁定灵兽 ›
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt>有效状态</dt>
          <dd>
            {enemy.effects.length > 0 ? (
              <ul className="enemy-effects">
                {enemy.effects.map((effect) => (
                  <li key={effect.label}>
                    <strong>{effect.label}</strong>
                    <span>{effect.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              '无'
            )}
          </dd>
        </div>
        {enemy.origin && (
          <div>
            <dt>衍生来源</dt>
            <dd>{enemy.origin}</dd>
          </div>
        )}
        <div>
          <dt>直属存活衍生</dt>
          <dd>{enemy.descendants} 只</dd>
        </div>
      </dl>
      <EnemyAttack key={`attack-${enemy.id}`} model={enemy.attack} onTarget={onTarget} />
      {!initialWarning && (
        <EnemyWarnings key={enemy.id} warnings={enemy.warnings} onSelect={onTarget} />
      )}
    </article>
  );
}

type Props = {
  view: EnemyInspectionView | null;
  stageId: number;
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onTarget: (id: number) => void;
  autoFocus?: boolean;
  initialWarning?: BossWarningTarget;
};

export function EnemyInspection({
  view,
  stageId,
  selectedId,
  onSelect,
  onTarget,
  autoFocus = false,
  initialWarning,
}: Props) {
  const enemy = view?.enemies.find((entry) => entry.id === selectedId) ?? view?.enemies[0];
  if (!enemy || !view) return <p role="status">当前场上没有存活敌人。</p>;
  return (
    <>
      <label className="inspection-select">
        查看敌人
        <select
          aria-label="查看敌人"
          autoFocus={autoFocus}
          value={enemy.id}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {view.enemies.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · #{entry.id} · 生命 {entry.hp}
            </option>
          ))}
        </select>
      </label>
      <EnemyDetails
        enemy={enemy}
        stageId={stageId}
        onTarget={onTarget}
        initialWarning={initialWarning?.source === enemy.id ? initialWarning : undefined}
      />
      <p className="inspection-note">
        锁定是当前缓存，包含正在接近的目标，不代表下一击或横扫目标。冻结可能推迟预警释放；这里只列已出现的预警，不预测下一次技能。
      </p>
      {enemy.effects.some((effect) => effect.label === '迟滞天赋') && (
        <p className="inspection-note">
          迟滞为全场天赋，与霜尾缓行分列；实际移速减幅受战斗上限约束。
        </p>
      )}
    </>
  );
}
