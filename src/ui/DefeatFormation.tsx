import { appearances, cells, type HeroId, type Point } from '../game/content';
import type { Preparation } from '../game/session';
import type { DefeatRecap } from './defeat-advice';
import { defeatFormation } from './defeat-formation';
import './defeat-formation.css';

type Props = { preparation: Preparation; recap: DefeatRecap; preparing: boolean };

function footprint(kind: HeroId, position: Point): string {
  return cells(kind, position)
    .map((point) => `${point.x + 1}列${point.y + 1}行`)
    .join('、');
}

export function DefeatFormation({ preparation, recap, preparing }: Props) {
  if (preparation.stageId !== recap.stageId) return null;
  const first = recap.firstFall;
  if (first === undefined) return <p className="defeat-fact">上次战报未记录重伤时间。</p>;
  if (first === null) return <p className="defeat-fact">上次守阵无灵兽重伤。</p>;
  const rows = preparing ? defeatFormation(preparation, recap) : [];
  return (
    <section className="defeat-formation" aria-label="首批重伤回顾">
      <p>
        首批重伤 · {(first.at / 1000).toFixed(2)} 秒 · {first.units.length}只
      </p>
      <p className="defeat-fact">
        {first.units
          .map((unit) => `${appearances[unit.kind].name}${unit.rank}阶 #${unit.id}`)
          .join('、')}
        。同批不区分先后，不代表唯一失守原因。
      </p>
      {preparing && (
        <details>
          <summary>对照首批重伤灵兽 · {rows.length}只</summary>
          <ul>
            {rows.map(({ previous, current, status }) => (
              <li key={previous.id}>
                <strong>
                  {appearances[previous.kind].name} · 编号{previous.id}
                </strong>
                <span>
                  上次：{previous.rank}阶 · 完整占格 {footprint(previous.kind, previous.position)}
                </span>
                {current ? (
                  <span>
                    当前：{current.rank}阶 ·{' '}
                    {status === 'reserve' ? (
                      '备战席，不参战'
                    ) : (
                      <>
                        {status === 'same' ? '原位' : '已换位'} · 完整占格{' '}
                        {footprint(current.kind, current.position!)}
                      </>
                    )}
                  </span>
                ) : (
                  <span>当前：已不在当前阵容</span>
                )}
              </li>
            ))}
          </ul>
          <small>按编号核对同一只灵兽；布阵和撤销后更新。此回顾仅本页保留，重新开战后清除。</small>
        </details>
      )}
    </section>
  );
}
