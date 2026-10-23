import {
  appearances,
  config,
  heroes,
  projectileSkillDescription,
  tauntValue,
} from '../game/content';
import { maxHeroHp } from '../game/combat-skills';
import { bonus } from '../game/progression';
import { sourceUnit, type Session, type Source } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';

export type Confirmation = { title: string; body: string; action: () => void; label: string };
type Props = {
  session: Session;
  selected: Source | null;
  message: string;
  choose: (s: Source) => void;
  dragStart: (e: React.PointerEvent, s: Source) => void;
  run: (error: string | null, success: string) => void;
  confirm: (d: Confirmation) => void;
  onStart: () => void;
  onSwap: (unitId: number) => void;
  onPresets: () => void;
  onMergePreview: (source: Source) => void;
  fieldReady: boolean;
  ignoreClick: () => boolean;
};
export function PreparationPanel({
  session,
  selected,
  message,
  choose,
  dragStart,
  run,
  confirm,
  onStart,
  onSwap,
  onPresets,
  onMergePreview,
  fieldReady,
  ignoreClick,
}: Props) {
  const p = session.preparation;
  const reserve = p.units.filter((u) => !u.position);
  const chosen = selected?.type === 'unit' ? p.units.find((u) => u.id === selected.id) : null;
  const offer = selected?.type === 'offer' ? p.offers.find((o) => o.id === selected.id) : null;
  const kind = chosen?.kind ?? (offer?.kind === 'cell' ? null : offer?.kind);
  const rank = chosen?.rank ?? offer?.rank ?? 1;
  const skill = kind
    ? projectileSkillDescription(kind, rank, bonus(p.progression, 'monkey_vulnerability'))
    : null;
  const refresh = () => {
    const action = () => run(session.refresh(true), '新招募已到，可以直接部署或合成。');
    if (p.offers.some((o) => !o.claimed))
      confirm({
        title: '刷新招募',
        body: `放弃本轮未领取的招募，花费 ${config.shop.refreshCost} 灵钱获得 3 个新招募。`,
        action,
        label: '花费 15 刷新',
      });
    else action();
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>灵兽招募</h2>
          <small>
            {p.offers.length === 4 ? '初次赠送 4 只 · 领取免费' : '八灵等概率 · 领取免费'}
          </small>
        </div>
        <button
          className="refresh-button"
          onClick={refresh}
          disabled={p.currency < config.shop.refreshCost}
        >
          <ArtImage asset="icon_refresh" /> 刷新 <span>◈ {config.shop.refreshCost}</span>
        </button>
      </div>
      <div className={`offers offers-${p.offers.length}`}>
        {p.offers.map((o) => {
          const skin =
            o.kind === 'cell'
              ? { name: '扩地令', color: '#dacda4', glyph: '土', role: '解锁 1 格' }
              : appearances[o.kind];
          return (
            <button
              key={o.id}
              className={`offer-card ${o.claimed ? 'claimed' : ''} ${selected?.type === 'offer' && selected.id === o.id ? 'selected' : ''}`}
              disabled={o.claimed}
              style={{ '--unit-color': skin.color } as React.CSSProperties}
              onClick={() => choose({ type: 'offer', id: o.id })}
              onPointerDown={(e) => dragStart(e, { type: 'offer', id: o.id })}
            >
              <span className="sigil">
                <ArtImage asset={o.kind === 'cell' ? 'icon_expand' : heroArt[o.kind]} />
                {o.claimed && <span className="claimed-check">✓</span>}
              </span>
              <strong>{skin.name}</strong>
              <small>{o.claimed ? '已领取' : skin.role}</small>
              <span className="card-rank">
                {o.kind === 'cell' ? '＋' : `${o.rank === 2 ? 'Ⅱ' : 'Ⅰ'} 阶`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="reserve-row">
        <div className="reserve-label">
          <strong>备战席</strong>
          <small>{reserve.length}/2 · 不参战</small>
        </div>
        <div className="reserve-slots" data-reserve>
          {[0, 1].map((i) => {
            const u = reserve[i];
            return (
              <button
                key={i}
                data-reserve-unit={u?.id}
                className={`reserve-slot ${selected?.type === 'unit' && selected.id === u?.id ? 'selected' : ''}`}
                onPointerDown={(e) => {
                  if (u) dragStart(e, { type: 'unit', id: u.id });
                }}
                onClick={() => {
                  if (ignoreClick()) return;
                  if (u && selected && !(selected.type === 'unit' && selected.id === u.id))
                    run(session.transfer(selected, { merge: u.id }), '合成成功！');
                  else if (u) choose({ type: 'unit', id: u.id });
                  else if (selected) run(session.transfer(selected, 'reserve'), '已送至备战席。');
                }}
              >
                {u ? (
                  <>
                    <ArtImage asset={heroArt[u.kind]} />
                    <span>
                      {appearances[u.kind].name} · {u.rank}阶
                    </span>
                  </>
                ) : (
                  '＋ 暂存'
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="instruction" role="status">
        {message}
      </p>
      {kind && (
        <div className="unit-detail">
          <span>
            {appearances[kind].name} · {rank}阶
          </span>
          <span>
            生命 {maxHeroHp({ id: 0, kind, rank: rank, position: null }, p.progression)} ·{' '}
            {kind === 'shield_fox'
              ? '提供护盾'
              : kind === 'fortune_peach'
                ? '定时产钱'
                : `基础伤害 ${heroes[kind].hitDamage[rank - 1]}`}
          </span>
          <span>仇恨 {tauntValue(kind)} · 同排先低阶，同阶越高越先受击</span>
          {skill && <span>{skill}</span>}
        </div>
      )}
      <div className="prepare-actions">
        <button className="secondary" onClick={onPresets}>
          阵型预设
        </button>
        {selected && sourceUnit(p, selected) && (
          <button
            className="secondary"
            onClick={() => onMergePreview(selected)}
            disabled={!fieldReady}
          >
            合成预览
          </button>
        )}
        <button
          className="secondary"
          disabled={!session.canUndo}
          onClick={() => run(session.undo(), '已撤销上一步布阵。')}
        >
          ↶ 撤销
        </button>
        {chosen && (
          <button className="secondary" onClick={() => onSwap(chosen.id)}>
            换位
          </button>
        )}
        {chosen && (
          <button
            className="secondary danger"
            onClick={() =>
              confirm({
                title: '遣散灵兽',
                body: '遣散不返还灵钱，无法撤销。',
                action: () => run(session.discard(chosen.id), '灵兽已遣散。'),
                label: '遣散',
              })
            }
          >
            遣散
          </button>
        )}
        <button className="primary start-button" onClick={onStart} disabled={!fieldReady}>
          {fieldReady ? '开始守阵' : '准备战场…'} <span>→</span>
        </button>
      </div>
    </>
  );
}
