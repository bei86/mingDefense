import { appearances } from '../game/content';
import type { FormationPlan } from '../game/formation-presets';
import type { Unit } from '../game/model';
import { formationChanges, formationPositionLabel } from './formation-changes';
import './formation-changes.css';

type Props = { current: readonly Unit[]; plan: FormationPlan | null };

export function FormationChanges({ current, plan }: Props) {
  const view = formationChanges(current, plan);
  if (!view) return null;
  return (
    <section className="formation-changes" aria-label="应用后的站位变化">
      <h3>应用将调整 {view.units.length} 只灵兽</h3>
      <p className="formation-change-counts">
        场内换位 {view.moved} · 备战上阵 {view.deployed} · 退回备战 {view.reserved}
      </p>
      <details>
        <summary>查看逐只站位变化</summary>
        <p className="formation-change-note">
          坐标为左上起点，上方为前排；多格灵兽的完整占格见预设小图。编号用于区分同种同阶灵兽。
        </p>
        <ol>
          {view.units.map((unit) => (
            <li key={unit.id}>
              <strong>
                {appearances[unit.kind].name} · {unit.rank}阶 <small>#{unit.id}</small>
              </strong>
              <span>
                {formationPositionLabel(unit.from)} <b aria-label="移至">→</b>{' '}
                {formationPositionLabel(unit.to)}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
