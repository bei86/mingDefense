import { useState } from 'react';
import { appearances, heroes } from '../game/content';
import type { FormationPlan } from '../game/formation-presets';
import type { Preparation } from '../game/session';
import type { FoxSupportModel, FoxSupportUnit } from './fox-support';
import { sourcesText } from './fox-support-text';
import { formationSupport } from './formation-support';
import './formation-support.css';

type Props = { preparation: Preparation; plan: FormationPlan | null };

function SupportState({ unit }: { unit: FoxSupportUnit | null }) {
  if (!unit) return <span>备战席 · 不提供或接受场上支援</span>;
  return (
    <>
      <span>
        {unit.front ? '前排' : '后排'} · 完整占格：
        {unit.cells.map((c) => `${c.x + 1}列${c.y + 1}行`).join('、')}
      </span>
      <span>施盾可达：{sourcesText(unit.shieldSources) || '无来源'}</span>
      <span>
        攻击光环：
        {unit.attacker ? sourcesText(unit.auraSources) || '无来源' : '不计输出（产钱或施盾）'}
      </span>
    </>
  );
}

function FormationContext({ model }: { model: FoxSupportModel }) {
  return (
    <span>
      {model.frontRow === null ? '无上阵灵兽' : `前排第${model.frontRow + 1}行`}
      {' · '}上阵狐{model.foxCount}只，光环狐{model.auraFoxCount}只
    </span>
  );
}

export function FormationSupport({ preparation, plan }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!plan || 'error' in plan) return null;
  const view = expanded ? formationSupport(preparation, plan) : null;
  const skill = heroes.shield_fox.skills;
  return (
    <details
      className="formation-support"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>对照狐支援覆盖</summary>
      {view && (
        <div>
          <table aria-label="阵型狐支援覆盖对照">
            <thead>
              <tr>
                <th scope="col">覆盖项目</th>
                <th scope="col">当前</th>
                <th scope="col">应用后</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['施盾可达', 'shieldReachableCount', 'units'],
                  ['前排施盾可达', 'shieldReachableFrontCount', 'frontCount'],
                  ['输出光环', 'auraAttackerCount', 'attackerCount'],
                ] as const
              ).map(([label, count, total]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {[view.before, view.after].map((m, i) => (
                    <td key={i}>
                      {m[count]}/{total === 'units' ? m.units.length : m[total]}只
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="formation-support-context">
            <div>
              <dt>当前</dt>
              <dd>
                <FormationContext model={view.before} />
              </dd>
            </div>
            <div>
              <dt>应用后</dt>
              <dd>
                <FormationContext model={view.after} />
              </dd>
            </div>
          </dl>
          <details className="formation-support-changes">
            <summary>查看逐兽支援变化 · {view.changes.length}只</summary>
            <p>
              列出上阵或备战、前排归属、来源编号变化；仅位置变化见上方站位对照。多格计一只，坐标从1开始。
            </p>
            {view.changes.length === 0 ? (
              <p>上阵状态、前排归属与覆盖来源相同；站位变化见上方。</p>
            ) : (
              view.changes.map((change) => {
                const unit = (change.before ?? change.after)!;
                return (
                  <section key={change.id} aria-label={`编号${change.id}支援变化`}>
                    <h3>
                      {appearances[unit.kind].name} · {unit.rank}阶 · 编号{change.id}
                    </h3>
                    <dl>
                      <div>
                        <dt>当前</dt>
                        <dd>
                          <SupportState unit={change.before} />
                        </dd>
                      </div>
                      <div>
                        <dt>应用后</dt>
                        <dd>
                          <SupportState unit={change.after} />
                        </dd>
                      </div>
                    </dl>
                  </section>
                );
              })
            )}
          </details>
          <p>
            按灵兽中心距离检查。狐可给自己施盾，一次只为一个目标施盾；可达不代表已有盾或下一次会获盾。
          </p>
          <p>
            {skill.auraFromRank}阶狐在固定{skill.auraRadiusCells}格内提供攻击光环 +
            {skill.auraAttackPercent}
            %，多个狐不叠加。射程天赋只扩大施盾范围。仅对照开战站位，不预测胜负或存活。
          </p>
        </div>
      )}
    </details>
  );
}
