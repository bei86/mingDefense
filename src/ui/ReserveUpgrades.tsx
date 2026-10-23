import { appearances } from '../game/content';
import type { Source } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import type { ReserveUpgrade } from './reserve-upgrades';

type Props = {
  upgrades: ReserveUpgrade[];
  selected: Source | null;
  choose: (source: Source) => void;
  fieldReady: boolean;
};

export function ReserveUpgrades({ upgrades, selected, choose, fieldReady }: Props) {
  if (!upgrades.length) return null;
  function chosen(id: number): boolean {
    return selected?.type === 'unit' && selected.id === id;
  }
  function select(id: number): void {
    if (!chosen(id)) choose({ type: 'unit', id });
  }
  return (
    <section className="reserve-upgrades" aria-label="同种高阶备战提示">
      <h3>备战席有同种更高阶灵兽</h3>
      <p>一次只换一对。选中灵兽后点「换位」，再选择对象；双方保持阶数，可撤销。</p>
      {upgrades.map(({ reserve, targets }) => {
        const name = appearances[reserve.kind].name;
        return (
          <div className="reserve-upgrade-card" key={reserve.id}>
            <div className="preparation-check-unit">
              <ArtImage asset={heroArt[reserve.kind]} />
              <strong>
                {name} · {reserve.rank}阶<small>备战 · 编号{reserve.id}</small>
              </strong>
              <button
                type="button"
                aria-label={`选中高阶备战${name}${reserve.rank}阶编号${reserve.id}`}
                aria-pressed={chosen(reserve.id)}
                disabled={!fieldReady}
                onClick={() => select(reserve.id)}
              >
                {chosen(reserve.id) ? '已选中' : '选中备战'}
              </button>
            </div>
            <details className="reserve-upgrade-targets">
              <summary>查看可换下的同种低阶 · {targets.length}只</summary>
              <ul>
                {targets.map((target) => (
                  <li key={target.id}>
                    <div className="preparation-check-unit">
                      <strong>
                        上阵 · {target.rank}阶 · 编号{target.id}
                      </strong>
                      <button
                        type="button"
                        aria-label={`查看上阵${name}${target.rank}阶编号${target.id}`}
                        aria-pressed={chosen(target.id)}
                        disabled={!fieldReady}
                        onClick={() => select(target.id)}
                      >
                        {chosen(target.id) ? '已选中' : '查看上阵'}
                      </button>
                    </div>
                    <small>
                      完整占格：
                      {target.cells.map((cell) => `${cell.x + 1}列${cell.y + 1}行`).join('、')}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      })}
      <p>列表按当前站位检查；多个备战可能对应同一目标，换位后会重新检查。</p>
    </section>
  );
}
