import { useState } from 'react';
import { appearances } from '../game/content';
import type { FormationPlan } from '../game/formation-presets';
import type { Preparation } from '../game/session';
import { formationTargeting } from './formation-targeting';
import type { TargetingEntry } from './targeting-preview';
import './formation-targeting.css';

type Props = { preparation: Preparation; plan: FormationPlan | null };

function Target({ unit }: { unit: TargetingEntry | null }) {
  if (!unit) return <span>无上阵灵兽</span>;
  return (
    <span>
      <strong>
        {appearances[unit.kind].name} · {unit.rank}阶
      </strong>{' '}
      <small>#{unit.id}</small>
      <small className="formation-target-position">
        {unit.position.x + 1}列{unit.position.y + 1}行 · 仇恨 {unit.taunt}
      </small>
    </span>
  );
}

export function FormationTargeting({ preparation, plan }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!plan || 'error' in plan) return null;
  const entries = expanded ? formationTargeting(preparation, plan) : null;
  return (
    <details
      className="formation-targeting"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>对照首个受击目标</summary>
      {entries && (
        <div className="formation-targeting-content">
          <p>
            固定敌人在各入口参考点，比较首个寻敌目标。先前排，同排先低阶，再按高仇恨、近距离选择。
          </p>
          {entries.map((entry) => (
            <section key={entry.column} aria-label={`第${entry.column + 1}列入口目标对照`}>
              <h3>第{entry.column + 1}列入口</h3>
              <dl>
                <div>
                  <dt>当前</dt>
                  <dd>
                    <Target unit={entry.before} />
                  </dd>
                </div>
                <div>
                  <dt>应用后</dt>
                  <dd>
                    <Target unit={entry.after} />
                  </dd>
                </div>
              </dl>
            </section>
          ))}
          <p>
            仅看已部署灵兽，备战不计；坐标为左上起点。距离相同按实例编号选择。
            这是静态寻敌参考，不代表阵亡顺序或伤害；实战移动、多敌人与首领技能会改变承伤。
          </p>
        </div>
      )}
    </details>
  );
}
