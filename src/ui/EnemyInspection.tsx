import { useState } from 'react';
import { appearances } from '../game/content';
import type { Combat } from '../game/combat-model';
import { bossArtKey, enemyArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { enemyInspection, enemySeconds, type InspectedEnemy } from './enemy-inspection';

function targetLabel(enemy: InspectedEnemy): string {
  const target = enemy.target;
  if (target) {
    return `${appearances[target.kind].name} · ${target.rank}阶 · ${target.position.x + 1}列${target.position.y + 1}行`;
  }
  return enemy.targetState === 'lost' ? '原目标已倒下或未记录，等待重新寻敌' : '尚未锁定灵兽';
}

function EnemyDetails({ enemy, stageId }: { enemy: InspectedEnemy; stageId: number }) {
  const art =
    enemy.kind === 'boss' ? bossArtKey(stageId, enemy.phase === '第二阶段') : enemyArt[enemy.kind];
  return (
    <article className="inspection-unit inspection-enemy">
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
          <dd>{targetLabel(enemy)}</dd>
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
      <div className="enemy-warnings">
        <h4>已出现的横扫预警</h4>
        {enemy.warnings.length > 0 ? (
          <ul>
            {enemy.warnings.map((warning, index) => (
              <li key={index}>
                <strong>
                  第 {warning.row} 行{warning.echo ? ' · 回响' : ''}
                </strong>
                <span>
                  {warning.remainingMs > 0
                    ? `剩余 ${enemySeconds(warning.remainingMs)} 秒`
                    : '待释放'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>当前没有已记录预警。</p>
        )}
      </div>
    </article>
  );
}

export function EnemyInspection({ battle }: { battle: Combat | null }) {
  const view = enemyInspection(battle);
  const [enemyId, setEnemyId] = useState(view?.initialId);
  const enemy = view?.enemies.find((entry) => entry.id === enemyId) ?? view?.enemies[0];
  if (!battle || !enemy || !view) return <p role="status">当前场上没有存活敌人。</p>;
  return (
    <>
      <label className="inspection-select">
        查看敌人
        <select
          aria-label="查看敌人"
          value={enemy.id}
          onChange={(event) => setEnemyId(Number(event.target.value))}
        >
          {view.enemies.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · #{entry.id} · 生命 {entry.hp}
            </option>
          ))}
        </select>
      </label>
      <EnemyDetails enemy={enemy} stageId={battle.stageId} />
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
