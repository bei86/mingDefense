import { useRef, useState } from 'react';
import { appearances, type EnemyKind } from '../game/content';
import { bossArtKey, enemyArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { EnemyWarnings } from './EnemyWarnings';
import { EnemyAttack } from './EnemyAttack';
import { EnemyBattleStats } from './EnemyBattleStats';
import { EnemyLineage } from './EnemyLineage';
import { EnemyIncoming } from './EnemyIncoming';
import { EnemySummon } from './EnemySummon';
import { enemyLineage, type EnemyLineageModel } from './enemy-lineage';
import type { InspectedEnemy, EnemyInspectionView } from './enemy-inspection';
import type { BossWarningTarget } from './boss-warnings';
import { selectEnemies, type EnemyFilter, type EnemyStatusFilter } from './enemy-selection';
import type { EnemySort } from './enemy-sorting';
import { EnemySelection } from './EnemySelection';
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
  lineage,
  onEnemy,
  initialWarning,
}: {
  enemy: InspectedEnemy;
  stageId: number;
  onTarget: (id: number) => void;
  lineage: EnemyLineageModel | null;
  onEnemy: (id: number) => void;
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
      </dl>
      <EnemyLineage key={`lineage-${enemy.id}`} model={lineage} onSelect={onEnemy} />
      <EnemySummon key={`summon-${enemy.id}`} model={enemy.summon} />
      <EnemyBattleStats key={`stats-${enemy.id}`} model={enemy.stats} />
      <EnemyAttack key={`attack-${enemy.id}`} model={enemy.attack} onTarget={onTarget} />
      <EnemyIncoming key={`incoming-${enemy.id}`} actions={enemy.incoming} onSelect={onTarget} />
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
  onIntel?: (kind: EnemyKind) => void;
};

export function EnemyInspection({
  view,
  stageId,
  selectedId,
  onSelect,
  onTarget,
  autoFocus = false,
  initialWarning,
  onIntel,
}: Props) {
  const [kind, setKind] = useState<EnemyFilter>('all');
  const [status, setStatus] = useState<EnemyStatusFilter>('all');
  const [order, setOrder] = useState<EnemySort>('default');
  const enemySelect = useRef<HTMLSelectElement>(null);
  const selection = selectEnemies(view, kind, selectedId, order, status);
  const enemy = selection.enemies.find((entry) => entry.id === selection.selectedId);
  if (selection.total === 0) return <p role="status">当前场上没有存活敌人。</p>;

  function changeFilter(nextKind: EnemyFilter, nextStatus: EnemyStatusFilter): void {
    const nextSelection = selectEnemies(view, nextKind, selection.selectedId, order, nextStatus);
    setKind(nextSelection.kind);
    setStatus(nextSelection.status);
    if (nextSelection.selectedId !== undefined) onSelect(nextSelection.selectedId);
  }
  function changeOrder(next: EnemySort): void {
    // The default enemy may be derived before the parent has an explicit instance ID.
    if (selection.selectedId !== undefined) onSelect(selection.selectedId);
    setOrder(next);
  }
  function showRelatedEnemy(id: number): void {
    if (!view?.enemies.some((entry) => entry.id === id)) return;
    setKind('all');
    setStatus('all');
    onSelect(id);
    enemySelect.current?.focus();
  }
  return (
    <>
      <EnemySelection
        selection={selection}
        onKind={(next) => changeFilter(next, status)}
        onStatus={(next) => changeFilter(kind, next)}
        onOrder={changeOrder}
        onSelect={onSelect}
        selectRef={enemySelect}
        autoFocus={autoFocus}
      />
      {enemy && (
        <EnemyDetails
          enemy={enemy}
          stageId={stageId}
          onTarget={onTarget}
          lineage={enemyLineage(view, enemy.id)}
          onEnemy={showRelatedEnemy}
          initialWarning={initialWarning?.source === enemy.id ? initialWarning : undefined}
        />
      )}
      {enemy && onIntel && (
        <button
          type="button"
          className="secondary inspection-handbook-button"
          aria-label={`查看${enemy.name}敌情档案`}
          onClick={() => onIntel(enemy.kind)}
        >
          查看敌情档案 ›
        </button>
      )}
      <p className="inspection-note">
        锁定是当前缓存，包含正在接近的目标，不代表下一击或横扫目标。冻结可能推迟预警释放；这里只列已出现的预警，不预测下一次技能。
      </p>
      {enemy?.effects.some((effect) => effect.label === '迟滞天赋') && (
        <p className="inspection-note">
          迟滞为全场天赋，与霜尾缓行分列；实际移速减幅受战斗上限约束。
        </p>
      )}
    </>
  );
}
