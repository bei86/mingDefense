import { useState } from 'react';
import { appearances, cells } from '../game/content';
import type { Session, Source } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { mergeLocation, mergePreview } from './merge-preview';
import './merge-preview.css';

type Props = {
  session: Session;
  source: Source;
  fieldReady: boolean;
  onMerge: (targetId: number) => string | null;
  onClose: () => void;
};

export function MergePreview({ session, source, fieldReady, onMerge, onClose }: Props) {
  const [targetId, setTargetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = session.preparation;
  const preview = mergePreview(p, source, session.maxRank);
  const model = 'error' in preview ? null : preview;
  // Never silently switch the retained unit if the selected target becomes unavailable.
  const target = model?.candidates.find((u) => u.id === targetId);
  let confirmLabel = '先选保留目标';
  if (target && model) confirmLabel = `合成至${model.unit.rank + 1}阶`;
  if (!fieldReady) confirmLabel = '等待战场就绪';
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal merge-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-title"
      >
        <div className="merge-heading">
          <div>
            <span className="eyebrow">整备 · 两只合为一只</span>
            <h2 id="merge-title">合成预览</h2>
          </div>
          <button className="icon-button" aria-label="关闭合成预览" onClick={onClose}>
            ×
          </button>
        </div>
        {model ? (
          <>
            <div className="merge-source">
              <ArtImage asset={heroArt[model.unit.kind]} />
              <div>
                <strong>
                  {appearances[model.unit.kind].name} · {model.unit.rank}阶 → {model.unit.rank + 1}
                  阶
                </strong>
                <small>消耗来源：{model.sourceLocation}</small>
              </div>
            </div>
            <p className="merge-note">
              比较单只基础值，未计本轮天赋；单次命中不是每秒伤害。合成后形状不变。
            </p>
            <table className="merge-stats">
              <caption>单只属性对比</caption>
              <thead>
                <tr>
                  <th scope="col">属性</th>
                  <th scope="col">{model.unit.rank}阶单只</th>
                  <th scope="col">{model.unit.rank + 1}阶单只</th>
                </tr>
              </thead>
              <tbody>
                {model.stats.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.before}</td>
                    <td className={row.before === row.after ? '' : 'changed'}>{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="merge-health">
              <span>两只合计生命 → 合成后一只</span>
              <strong>
                {model.combinedHp.toLocaleString('zh-CN')} →{' '}
                {model.resultHp.toLocaleString('zh-CN')}
              </strong>
              <small>此项含本轮生命加成；合成会减少一只灵兽，总生命可能下降。</small>
              {source.type === 'offer' && <small>未领取招募按领取后的生命上限计算。</small>}
            </div>
            <div className="merge-skills">
              <h3>本次解锁</h3>
              {model.newSkills.length ? (
                model.newSkills.map((skill) => (
                  <p key={skill.name}>
                    <strong>{skill.name}</strong> · {skill.description}
                  </p>
                ))
              ) : (
                <p>本次升阶无新增阶数技能，已有技能保留；专属天赋仍需另选。</p>
              )}
            </div>
            <fieldset className="merge-targets">
              <legend>选择保留目标 · {model.candidates.length}只可合成</legend>
              {model.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={candidate.id === targetId}
                  onClick={() => {
                    setTargetId(candidate.id);
                    setError(null);
                  }}
                >
                  <ArtImage asset={heroArt[candidate.kind]} />
                  <span>
                    <strong>
                      {appearances[candidate.kind].name} · {candidate.rank}阶
                    </strong>
                    <small>{mergeLocation(p, candidate)}</small>
                  </span>
                  <span aria-hidden="true">{candidate.id === targetId ? '✓' : '选'}</span>
                </button>
              ))}
              {!model.candidates.length && (
                <p role="status">
                  当前没有已领取的同种同阶灵兽。可先部署或暂存另一张招募，再来预览。
                </p>
              )}
            </fieldset>
            {target && (
              <div className="merge-result" role="status">
                <strong>合成后留在：{mergeLocation(p, target)}</strong>
                {target.position && (
                  <small>
                    完整占格：
                    {cells(target.kind, target.position)
                      .map((cell) => `${cell.x + 1}列${cell.y + 1}行`)
                      .join('、')}
                  </small>
                )}
                <p>{model.sourceRelease}</p>
              </div>
            )}
            {targetId !== null && !target && (
              <p role="status">合成对象已变化，请重新选择；不会自动改选其他灵兽。</p>
            )}
            {error && (
              <p className="merge-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={!target || !fieldReady}
              onClick={() => {
                if (target) setError(onMerge(target.id));
              }}
            >
              {confirmLabel}
            </button>
            <p className="merge-note">成功后可用「撤销」恢复这次合成。</p>
          </>
        ) : (
          <p role="status">{preview.error}</p>
        )}
        <button className="secondary" onClick={onClose}>
          返回布阵
        </button>
      </section>
    </div>
  );
}
