import type { Combat } from '../game/combat-model';
import { timeLabel } from './CampaignPanels';
import { arrivalLabel, upcomingEnemies } from './upcoming-enemies';
import './upcoming-enemies.css';

export function UpcomingEnemies({ battle }: { battle: Combat | null }) {
  const view = upcomingEnemies(battle);
  if (!view) return <p role="status">暂无战斗出怪队列。</p>;
  return (
    <section className="upcoming-enemies" aria-label="后续固定敌袭">
      <div className="upcoming-total">
        <span>未出场固定敌人</span>
        <strong>
          {view.remaining} <small>只</small>
        </strong>
      </div>
      {view.ended && <p className="inspection-note">本场已结束，未执行的固定队列不会继续出场。</p>}
      {view.remaining > 0 ? (
        <>
          <ul className="upcoming-counts" aria-label="剩余固定敌人种类">
            {view.counts.map((entry) => (
              <li key={entry.kind}>
                {entry.name} ×{entry.count}
              </li>
            ))}
          </ul>
          <h3>
            {view.ended ? '未执行计划' : '接下来'} {view.next.length} 只
          </h3>
          <ol className="upcoming-list" aria-label="接下来固定出场的敌人">
            {view.next.map((enemy) => (
              <li key={enemy.index}>
                <div>
                  <strong>{enemy.name}</strong>
                  <small>
                    第{enemy.column}列入口 · 计划 {timeLabel(enemy.at)}
                  </small>
                </div>
                <span>{view.ended ? '未执行' : arrivalLabel(enemy.remainingMs)}</span>
              </li>
            ))}
          </ol>
          {view.hiddenCount > 0 && (
            <p className="inspection-note">
              另有 {view.hiddenCount} 只固定敌人排在其后，种类数量已包含在上方统计。
            </p>
          )}
        </>
      ) : (
        <p className="inspection-note" role="status">
          {view.ended
            ? '本场固定队列已全部执行。'
            : '固定出怪已结束。场上敌人及后续召唤、分裂仍需清理。'}
        </p>
      )}
      <p className="inspection-note">
        以上为游戏内出场时间，暂停或选天赋时不推进，倍速会缩短现实等待。出场不等于抵达阵线或发动攻击。
      </p>
      <p className="inspection-note">
        仅统计本场固定队列，包含固定首领；召唤与分裂随战况变化，不计入此队列。
      </p>
    </section>
  );
}
