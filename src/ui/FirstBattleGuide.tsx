import { useState } from 'react';
import type { Session, Source } from '../game/session';
import { firstBattleGuide } from './first-battle-guide';

type Props = {
  session: Session;
  selected: Source | null;
  choose: (source: Source) => void;
};

export function FirstBattleGuide({ session, selected, choose }: Props) {
  const [expanded, setExpanded] = useState(true);
  const hint = firstBattleGuide(session);
  if (!hint) return null;
  const source = hint.source;
  const chosen = source?.type === selected?.type && source?.id === selected?.id;

  return (
    <details
      className="first-battle-guide"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>首战指引</strong>
        <span>{expanded ? '收起' : '展开'}</span>
      </summary>
      <div className="guide-content">
        <h2>{hint.title}</h2>
        <p>{hint.description}</p>
        {source && (
          <button
            className="guide-choice"
            aria-pressed={chosen}
            onClick={() => {
              if (!chosen) choose(source);
            }}
          >
            {chosen ? '✓ 已选中' : '选中'} {hint.sourceName}
          </button>
        )}
      </div>
    </details>
  );
}
