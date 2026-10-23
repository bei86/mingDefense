import { useRef, useState } from 'react';
import { appearances, config, heroes } from '../game/content';
import {
  captureFormation,
  planFormation,
  validFormation,
  type FormationPreset,
} from '../game/formation-presets';
import type { Session } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import type { useFormationPresets } from './useFormationPresets';
import './formation-presets.css';

type Props = {
  session: Session;
  library: ReturnType<typeof useFormationPresets>;
  isolated: boolean;
  onClose: () => void;
  onApply: (preset: FormationPreset) => string | null;
};

function PresetBoard({ preset }: { preset: FormationPreset }) {
  return (
    <>
      <div className="preset-board" role="img" aria-label="预设完整占格，上方为前排">
        {Array.from({ length: config.board.columns * config.board.rows }, (_, i) => (
          <span
            className="preset-cell"
            key={i}
            style={{
              gridColumn: (i % config.board.columns) + 1,
              gridRow: Math.floor(i / config.board.columns) + 1,
            }}
          />
        ))}
        {preset.units.map(
          (unit, i) =>
            unit.position && (
              <span
                className="preset-unit"
                key={i}
                title={`${appearances[unit.kind].name}${unit.rank}阶：${unit.position.x + 1}列${unit.position.y + 1}行`}
                style={{
                  gridColumn: `${unit.position.x + 1} / span ${Math.max(...heroes[unit.kind].shape.map(([x]) => x)) + 1}`,
                  gridRow: `${unit.position.y + 1} / span ${Math.max(...heroes[unit.kind].shape.map(([, y]) => y)) + 1}`,
                }}
              >
                <ArtImage key={unit.kind} asset={heroArt[unit.kind]} />
                <small>
                  {appearances[unit.kind].glyph}
                  {unit.rank}
                </small>
              </span>
            ),
        )}
      </div>
      <p className="preset-reserves">
        备战席：
        {preset.units
          .filter((unit) => unit.position === null)
          .map((unit) => `${appearances[unit.kind].name}${unit.rank}阶`)
          .join('、') || '无'}
      </p>
    </>
  );
}

export function FormationPresets({ session, library, isolated, onClose, onApply }: Props) {
  const [slot, setSlot] = useState(0);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<{ slot: number; action: 'save' | 'delete' } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const preset = library.slots[slot];
  const current = captureFormation(session.preparation.units);
  const canSave = validFormation(current);
  const plan = preset ? planFormation(session.preparation, preset) : null;
  const difference = plan && 'error' in plan ? plan.difference : undefined;
  let unavailable = '此槽位尚未保存';
  if (plan) unavailable = 'error' in plan ? plan.error : '阵容与占格校验通过，应用后可撤销';
  const save = (index: number, value: FormationPreset | null) => {
    const error = library.update(index, value);
    let success = `已保存阵型${index + 1}`;
    if (value === null) success = `已删除阵型${index + 1}`;
    else if (isolated) success += '（仅本次试玩，刷新清空）';
    setNotice(error ?? success);
    setPending(null);
    closeRef.current?.focus();
  };
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal formation-presets"
        role="dialog"
        aria-modal="true"
        aria-labelledby="presets-title"
      >
        <div className="presets-heading">
          <div>
            <span className="eyebrow">整备 · 保留不同站位</span>
            <h2 id="presets-title">阵型预设</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label="关闭阵型预设"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="presets-note">
          只保存站位，应用需要灵兽种类、阶数、数量相同。招募、合成或遣散后，请重新保存。
        </p>
        <p className="presets-scope">
          {isolated
            ? '开发试玩：不读取或写入正式预设；临时槽刷新后清空。'
            : '仅当前浏览器保存；战役备份不包含预设。'}
        </p>
        <div className="preset-tabs" role="group" aria-label="选择阵型槽位">
          {library.slots.map((entry, index) => (
            <button
              key={index}
              disabled={Boolean(pending)}
              aria-pressed={slot === index}
              onClick={() => {
                setSlot(index);
                setNotice('');
              }}
            >
              <strong>阵型{index + 1}</strong>
              <small>
                {entry ? `${entry.units.filter((unit) => unit.position).length}只上阵` : '未保存'}
              </small>
            </button>
          ))}
        </div>
        {preset ? (
          <PresetBoard key={slot} preset={preset} />
        ) : (
          <div className="preset-empty">
            此槽位空着
            <br />
            <small>保存当前阵容，记下这套站位</small>
          </div>
        )}
        <p className="preset-availability">{unavailable}</p>
        {difference && (
          <section className="preset-difference" aria-label="与当前阵容的差异">
            {(
              [
                ['missing', '按预设还缺'],
                ['extra', '当前多出'],
              ] as const
            ).map(([side, title]) => (
              <div key={side}>
                <h3>{title}</h3>
                {difference[side].length ? (
                  <ul aria-label={title}>
                    {difference[side].map((unit) => (
                      <li key={`${unit.kind}:${unit.rank}`}>
                        <span>
                          {appearances[unit.kind].name} · {unit.rank}阶
                        </span>
                        <strong>{unit.count}只</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>无</p>
                )}
              </div>
            ))}
            <p className="preset-difference-note">
              含上阵与备战席，按种类、阶数分别比较；高阶不抵低阶。“多出”仅指超出此预设。
              如需保留当前阵容，请保存当前站位并确认覆盖。
            </p>
          </section>
        )}
        {!canSave && <p className="preset-availability">请先在棋盘部署至少一只灵兽再保存。</p>}
        {(notice || library.error) && (
          <p className="preset-notice" role="status">
            {notice || library.error}
          </p>
        )}
        {library.error && (
          <button
            className="secondary"
            disabled={Boolean(pending)}
            onClick={() => {
              setNotice('');
              library.reload();
            }}
          >
            重试读取预设
          </button>
        )}
        {pending ? (
          <div className="preset-confirm" role="group" aria-label="确认预设操作">
            <p>
              {pending.action === 'save'
                ? `用当前站位覆盖阵型${pending.slot + 1}？原站位将被替换。`
                : `删除阵型${pending.slot + 1}？当前战役阵容不受影响。`}
            </p>
            <button
              className="primary"
              autoFocus
              onClick={() => save(pending.slot, pending.action === 'save' ? current : null)}
            >
              {pending.action === 'save' ? '确认覆盖' : '确认删除'}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setPending(null);
                closeRef.current?.focus();
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <div className="preset-actions">
            <button
              className="primary"
              disabled={!preset || !plan || 'error' in plan}
              onClick={() => {
                if (!preset) return;
                const error = onApply(preset);
                if (error) setNotice(error);
              }}
            >
              应用阵型{slot + 1}
            </button>
            <button
              className="secondary"
              disabled={!canSave || Boolean(library.error)}
              onClick={() => {
                if (preset) setPending({ slot, action: 'save' });
                else save(slot, current);
              }}
            >
              保存到阵型{slot + 1}
            </button>
            <button
              className="text-button"
              disabled={!preset || Boolean(library.error)}
              onClick={() => setPending({ slot, action: 'delete' })}
            >
              删除此预设
            </button>
          </div>
        )}
        <button className="secondary preset-back" onClick={onClose}>
          返回布阵
        </button>
      </section>
    </div>
  );
}
