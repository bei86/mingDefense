import { useState } from 'react';
import { appearances, heroIds, type HeroId } from '../game/content';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { spiritHandbookEntry } from './spirit-handbook';

export type HandbookTarget = { kind: HeroId; rank: number };
type Props = {
  onClose: () => void;
  initialEntry?: HandbookTarget;
  closeLabel?: string;
};

export function SpiritHandbook({ onClose, initialEntry, closeLabel = '收起图鉴' }: Props) {
  const [kind, setKind] = useState<HeroId>(initialEntry?.kind ?? 'ember_mouse');
  const [rank, setRank] = useState(initialEntry?.rank ?? 1);
  const entry = spiritHandbookEntry(kind, rank);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal handbook-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handbook-title"
      >
        <div className="handbook-heading">
          <div>
            <span className="eyebrow">守阵手札 · 八灵篇</span>
            <h2 id="handbook-title">灵兽图鉴</h2>
          </div>
          <button className="icon-button" aria-label="关闭灵兽图鉴" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="handbook-note">当前原型基础值，未计入本轮加成；部分数值仍待活动实机校准。</p>
        <div className="handbook-roster" role="group" aria-label="选择灵兽">
          {heroIds.map((id) => (
            <button key={id} aria-pressed={id === kind} onClick={() => setKind(id)}>
              <ArtImage asset={heroArt[id]} />
              <span>{appearances[id].name}</span>
            </button>
          ))}
        </div>
        <div className="handbook-ranks" role="group" aria-label="查看阶数">
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <button key={value} aria-pressed={rank === value} onClick={() => setRank(value)}>
              {value}阶
            </button>
          ))}
        </div>
        <div className="handbook-profile">
          <ArtImage asset={heroArt[kind]} />
          <div>
            <h3>
              {entry.name} · {rank}阶
            </h3>
            <p>{entry.role}</p>
          </div>
          <div
            className="handbook-shape"
            role="img"
            aria-label={`${entry.name}占格：${entry.role}；左上角为放置基准`}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className={
                  entry.shape.some(([x, y]) => x === i % 3 && y === Math.floor(i / 3))
                    ? 'occupied'
                    : ''
                }
              />
            ))}
          </div>
        </div>
        <p className="handbook-note">实心格为占位，左上角为放置基准；升阶不改变形状。</p>
        <dl className="handbook-stats">
          {entry.stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
        <p className="handbook-note">
          命中伤害是单次基础值，技能、多弹和多段另算，不是每秒伤害。敌人先清前排，同排先低阶，同阶仇恨越高越先受击。
        </p>
        <ul className="handbook-skills">
          {entry.skills.map((skill) => (
            <li key={skill.name} className={skill.unlocked ? '' : 'locked'}>
              <div>
                <strong>{skill.name}</strong>
                <small>
                  {skill.requiresTalent && '需另选天赋'}
                  {!skill.requiresTalent &&
                    (skill.unlocked ? '当前阶可用' : `${skill.fromRank}阶解锁`)}
                </small>
              </div>
              <p>{skill.description}</p>
            </li>
          ))}
        </ul>
        <button className="secondary" onClick={onClose}>
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
