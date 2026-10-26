import type { Combat } from '../game/combat-model';
import { BattleFormation } from './BattleFormation';
import { ReportUnits } from './ReportUnits';
import {
  fallTimeline,
  fallTimelineEmpty,
  fallTimelineMissing,
  fallTimelineNote,
} from './fall-timeline';
import './fall-timeline.css';

export function BattleReport({ battle }: { battle: Combat }) {
  const report = battle.report;
  const timeline = fallTimeline(battle);
  if (!report)
    return (
      <>
        <p className="report-note">这份旧战报未记录逐兽数据和重伤时间，下次战斗起提供。</p>
        <BattleFormation battle={battle} />
      </>
    );
  return (
    <details className="unit-report">
      <summary>
        逐兽战报 <span>伤害 · 承伤 · 产钱</span>
      </summary>
      <BattleFormation battle={battle} />
      <ReportUnits battle={battle} />
      <section className="fall-timeline" aria-label="重伤时间线">
        <h3>重伤时间线</h3>
        {timeline === null && <p>{fallTimelineMissing}</p>}
        {timeline?.length === 0 && <p>{fallTimelineEmpty}</p>}
        {timeline && timeline.length > 0 && (
          <>
            <ol>
              {timeline.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <p>{fallTimelineNote}</p>
          </>
        )}
      </section>
      <p className="report-note">
        伤害仅计实际扣血，承伤不含护盾吸收；产钱仅计桃的产出。 聚灵实际生效{' '}
        {(report.boostedMs / 1000).toFixed(1)} 秒。
        {battle.result === 'defeat' && '本关产钱与成长不保留。'}
      </p>
    </details>
  );
}
