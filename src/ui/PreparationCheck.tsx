import { useState } from 'react';
import { appearances } from '../game/content';
import type { Session, Source } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { preparationCheck } from './preparation-check';
import { reserveUpgrades } from './reserve-upgrades';
import { ReserveUpgrades } from './ReserveUpgrades';
import './preparation-check.css';

type Props = {
  session: Session;
  selected: Source | null;
  choose: (source: Source) => void;
  fieldReady: boolean;
};

export function PreparationCheck({ session, selected, choose, fieldReady }: Props) {
  const [expanded, setExpanded] = useState(false);
  const p = session.preparation;
  const reserveCount = p.units.filter((unit) => !unit.position).length;
  const pendingCount = p.offers.filter((offer) => !offer.claimed).length;
  const upgrades = reserveUpgrades(p);
  const check = expanded ? preparationCheck(p, session.maxRank) : null;
  return (
    <details
      className="preparation-check"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>战前检查</strong>
        <small>
          备战{reserveCount} · 待领{pendingCount}
          {upgrades.length > 0 && (
            <em className="reserve-upgrade-badge">同种高阶{upgrades.length}只</em>
          )}
        </small>
        <span>{expanded ? '收起 −' : '展开 ＋'}</span>
      </summary>
      {check && (
        <div className="preparation-check-content">
          <dl className="preparation-check-stats">
            <div>
              <dt>上阵 / 输出</dt>
              <dd>
                {check.deployedCount} / {check.attackerCount}只
              </dd>
            </div>
            <div>
              <dt>上阵生命上限</dt>
              <dd>{check.deployedHp.toLocaleString('zh-CN')}</dd>
            </div>
            <div>
              <dt>已解锁空格</dt>
              <dd>{check.emptyCells}格</dd>
            </div>
          </dl>
          {check.deployedCount === 0 && (
            <p className="preparation-check-warning">棋盘上还没有灵兽，至少部署一只才能开战。</p>
          )}
          {check.deployedCount > 0 && check.attackerCount === 0 && (
            <p className="preparation-check-warning">
              当前没有能造成伤害的灵兽。产钱和护盾需要输出伙伴。
            </p>
          )}
          <p>只检查当前布阵，不预测胜负。备战与待领招募不计入参战生命或输出。</p>
          <ReserveUpgrades
            upgrades={upgrades}
            selected={selected}
            choose={choose}
            fieldReady={fieldReady}
          />
          {(['reserve', 'offer'] as const).map((origin) => {
            const items = check.items.filter((item) => item.origin === origin);
            return (
              <section
                key={origin}
                aria-label={origin === 'reserve' ? '备战席检查' : '待领招募检查'}
              >
                <h3>{origin === 'reserve' ? '备战席 · 不参战' : '未领取招募 · 领取免费'}</h3>
                {items.length === 0 && (
                  <p>{origin === 'reserve' ? '备战席为空。' : '本轮招募已全部领取。'}</p>
                )}
                <ul>
                  {items.map((item) => {
                    const chosen =
                      selected?.type === item.source.type && selected.id === item.source.id;
                    const name =
                      item.kind === 'cell'
                        ? '扩地令'
                        : `${appearances[item.kind].name} · ${item.rank}阶`;
                    let placementText = `完整落点：${item.placements}处`;
                    if (item.kind === 'cell') placementText = `可扩地位置：${item.placements}处`;
                    else if (!item.placements)
                      placementText = '当前没有完整空位，可调整站位或换位。';
                    return (
                      <li key={`${item.source.type}-${item.source.id}`}>
                        <div className="preparation-check-unit">
                          <ArtImage
                            asset={item.kind === 'cell' ? 'icon_expand' : heroArt[item.kind]}
                          />
                          <strong>{name}</strong>
                          <button
                            aria-label={`选中${origin === 'reserve' ? '备战' : '招募'}${name}`}
                            aria-pressed={chosen}
                            disabled={!fieldReady}
                            onClick={() => {
                              if (!chosen) choose(item.source);
                            }}
                          >
                            {chosen ? '已选中' : '选中'}
                          </button>
                        </div>
                        <small>{placementText}</small>
                        {item.kind !== 'cell' && (
                          <small>
                            {item.rank! >= session.maxRank
                              ? '已达本模式最高阶，无法继续合成。'
                              : `可合成目标：${item.mergeTargets}只（已领取的同种同阶）`}
                          </small>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="preparation-check-note">
            完整落点按整只灵兽能放下的位置计算，各位置可能重叠。选中后仍需自己布阵；合成可先打开「合成预览」查看取舍。扩地令需点边相邻的未解锁格子。
          </p>
        </div>
      )}
    </details>
  );
}
