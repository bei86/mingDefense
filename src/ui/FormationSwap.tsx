import { appearances, type Point } from '../game/content';
import { swapError, type Session } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';

type Props = {
  session: Session;
  sourceId: number;
  onClose: () => void;
  onSwap: (targetId: number) => void;
};

function positionLabel(position: Point | null): string {
  return position ? `${position.x + 1}列${position.y + 1}行` : '备战席';
}

export function FormationSwap({ session, sourceId, onClose, onSwap }: Props) {
  const p = session.preparation;
  const source = p.units.find((u) => u.id === sourceId);
  const candidates = p.units.filter((u) => u.id !== sourceId);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal formation-swap"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
      >
        <div className="swap-heading">
          <div>
            <span className="eyebrow">整备 · 调整站位</span>
            <h2 id="swap-title">灵兽换位</h2>
          </div>
          <button className="icon-button" aria-label="关闭灵兽换位" onClick={onClose}>
            ×
          </button>
        </div>
        {source ? (
          <>
            <div className="swap-source">
              <ArtImage asset={heroArt[source.kind]} />
              <div>
                <strong>
                  {appearances[source.kind].name} · {source.rank}阶
                </strong>
                <small>当前：{positionLabel(source.position)}</small>
              </div>
            </div>
            <p>选择另一只灵兽，点击即可互换。多格灵兽按左上占格对齐；换位保持阶数，可撤销。</p>
            <div className="swap-candidates" role="group" aria-label="换位对象">
              {candidates.map((target) => {
                const error = swapError(p, sourceId, target.id);
                const descriptionId = `swap-option-${target.id}`;
                return (
                  <div key={target.id} className={`swap-option ${error ? 'unavailable' : ''}`}>
                    <button
                      disabled={Boolean(error)}
                      aria-describedby={descriptionId}
                      onClick={() => onSwap(target.id)}
                    >
                      <ArtImage asset={heroArt[target.kind]} />
                      <span>
                        <strong>
                          与{appearances[target.kind].name} · {target.rank}阶换位
                        </strong>
                        <small>当前：{positionLabel(target.position)}</small>
                      </span>
                      <span className="swap-arrow" aria-hidden="true">
                        ⇄
                      </span>
                    </button>
                    <p id={descriptionId}>
                      {error ??
                        `${appearances[source.kind].name} → ${positionLabel(target.position)}；${appearances[target.kind].name} → ${positionLabel(source.position)}`}
                    </p>
                  </div>
                );
              })}
            </div>
            {!candidates.length && <p role="status">尚无其他灵兽，先领取招募后再来换位。</p>}
          </>
        ) : (
          <p role="status">所选灵兽已不在阵容，请关闭后重新选择。</p>
        )}
        <button className="secondary" onClick={onClose}>
          返回布阵
        </button>
      </section>
    </div>
  );
}
