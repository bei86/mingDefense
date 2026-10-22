import type { Session } from '../game/session';
import { preparationAdvice, type DefeatRecap } from './defeat-advice';

export function DefeatAdvice({
  session,
  recap,
  preparing = false,
}: {
  session: Session;
  recap: DefeatRecap | null;
  preparing?: boolean;
}) {
  if (!recap || recap.stageId !== session.preparation.stageId) return null;
  const tips = preparationAdvice(session.preparation, session.maxRank, recap);
  const content = (
    <div className="defeat-advice-content">
      <strong>{recap.title}</strong>
      <p>{recap.detail}</p>
      {recap.damageFact && <p className="defeat-fact">{recap.damageFact}</p>}
      <ul>
        {tips.map((tip) => (
          <li key={tip.id}>{tip.text}</li>
        ))}
      </ul>
      <small>建议按当前整备阵容更新，仅供尝试；上次承伤不等于唯一失守原因。</small>
    </div>
  );
  return (
    <details className="defeat-advice" open={preparing}>
      <summary>{preparing ? '上次失守复盘 · 可收起' : `失守复盘 · ${recap.title}`}</summary>
      {content}
    </details>
  );
}
