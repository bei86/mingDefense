import { useState } from 'react';
import type { EnemyKind } from '../game/content';
import type { Combat } from '../game/combat-model';
import { timeLabel } from './CampaignPanels';
import {
  arrivalLabel,
  upcomingEnemies,
  UPCOMING_PAGE_SIZE,
  type UpcomingEnemyView,
} from './upcoming-enemies';
import './upcoming-enemies.css';

type ListProps = {
  view: UpcomingEnemyView;
  onPage: (page: number) => void;
  onIntel?: (kind: EnemyKind) => void;
};

export function UpcomingEnemyList({ view, onPage, onIntel }: ListProps) {
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
              <li key={entry.kind} className={onIntel ? 'upcoming-kind-link' : undefined}>
                {onIntel ? (
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`查看后续${entry.name}敌情档案，未出场${entry.count}只`}
                    onClick={() => onIntel(entry.kind)}
                  >
                    {entry.name} ×{entry.count} <span aria-hidden="true">›</span>
                  </button>
                ) : (
                  <>
                    {entry.name} ×{entry.count}
                  </>
                )}
              </li>
            ))}
          </ul>
          {onIntel && (
            <p className="inspection-note">
              点种类查看敌情档案。这里统计未出场数量；档案中的固定数量是本关总数，属性为本关配置基础值。
            </p>
          )}
          <h3>
            {view.ended ? '未执行计划' : '本页计划'} {view.next.length} 只
          </h3>
          <p className="inspection-note" role="status">
            第 {view.page * UPCOMING_PAGE_SIZE + 1}–
            {view.page * UPCOMING_PAGE_SIZE + view.next.length} 只 / 共 {view.remaining} 只
          </p>
          {view.pageCount > 1 && (
            <nav className="upcoming-pages" aria-label="固定敌袭翻页">
              <button
                type="button"
                className="secondary"
                aria-label="上一页固定敌袭"
                disabled={view.page === 0}
                onClick={() => onPage(view.page - 1)}
              >
                上一页
              </button>
              <span>
                第 {view.page + 1} / {view.pageCount} 页
              </span>
              <button
                type="button"
                className="secondary"
                aria-label="下一页固定敌袭"
                disabled={view.page === view.pageCount - 1}
                onClick={() => onPage(view.page + 1)}
              >
                下一页
              </button>
            </nav>
          )}
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
              另有 {view.hiddenCount} 只固定敌人未在本页显示，种类数量已包含在上方统计。
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

export function UpcomingEnemies({
  battle,
  onIntel,
}: {
  battle: Combat | null;
  onIntel?: (kind: EnemyKind) => void;
}) {
  const [page, setPage] = useState(0);
  const view = upcomingEnemies(battle, page);
  if (!view) return <p role="status">暂无战斗出怪队列。</p>;
  return <UpcomingEnemyList view={view} onPage={setPage} onIntel={onIntel} />;
}
