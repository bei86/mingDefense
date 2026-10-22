import { useId } from 'react';
import { appearances, config } from '../game/content';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import type { TargetingPreview } from './targeting-preview';

type Props = {
  preview: TargetingPreview | null;
  onToggle: () => void;
  column: number;
  onColumn: (column: number) => void;
};

export function TargetingPanel({ preview, onToggle, column, onColumn }: Props) {
  const contentId = useId();
  return (
    <section className="targeting-panel" aria-label="受击顺序预览">
      <button
        className="targeting-toggle"
        aria-expanded={preview !== null}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span>
          受击顺序预览 <small>看谁先扛伤</small>
        </span>
        <span>{preview ? '收起 −' : '展开 ＋'}</span>
      </button>
      <div id={contentId} hidden={!preview} className="targeting-content">
        {preview && (
          <>
            <div className="targeting-columns" role="group" aria-label="敌人参考入场列">
              <span>参考入口</span>
              {config.waves.spawnColumns.map((value) => (
                <button key={value} aria-pressed={column === value} onClick={() => onColumn(value)}>
                  第{value + 1}列
                </button>
              ))}
            </div>
            <p className="targeting-reference">
              按第{preview.column + 1}列入口静态寻敌排序，不预测实战阵亡顺序。
            </p>
            {preview.first ? (
              <>
                <p className="targeting-first" role="status">
                  首个寻敌目标：{appearances[preview.first.kind].name} · {preview.first.rank}阶 · 第
                  {preview.first.position.y + 1}行
                </p>
                <p>先清前排，再找下一排；同排先低阶，再按高仇恨、近距离选择。</p>
                {preview.rows.map((row, index) => (
                  <div className="targeting-row" key={row.row}>
                    <h3>
                      第{row.row + 1}行 <span>{index === 0 ? '当前前排' : '前方各排清空后'}</span>
                    </h3>
                    <ol start={row.units[0].order}>
                      {row.units.map((unit) => (
                        <li key={unit.id} value={unit.order}>
                          <div className="targeting-unit">
                            <ArtImage asset={heroArt[unit.kind]} />
                            <div>
                              <strong>
                                {appearances[unit.kind].name} · {unit.rank}阶
                              </strong>
                              <small>
                                {unit.position.x + 1}列{unit.position.y + 1}行 · 仇恨 {unit.taunt}
                              </small>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </>
            ) : (
              <p role="status">棋盘上还没有灵兽，请先部署。备战席与未领取招募不参战。</p>
            )}
            <p className="targeting-note">
              依次移除上一目标后继续寻敌；多格按最上占格归排，距离相同再按固定顺序选择。实战移动、多敌人和首领技能会改变承伤。当前仅看已部署阵容；收起可恢复射程预览。
            </p>
          </>
        )}
      </div>
    </section>
  );
}
