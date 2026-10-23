import { useRef, useState } from 'react';
import type { FormationPreset } from '../game/formation-presets';
import { createFormationShare, inspectFormationShare } from './formation-share';
import { PresetBoard } from './PresetBoard';
import './formation-share.css';

type Props = {
  slot: number;
  preset: FormationPreset | null;
  blocked: boolean;
  isolated: boolean;
  onImport: (preset: FormationPreset) => string | null;
};

function ShareContent({ slot, preset, blocked, isolated, onImport }: Props) {
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<FormationPreset | null>(null);
  const [notice, setNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const importRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="formation-share-content">
      <p>
        单套站位可带到另一浏览器或手机。不包含灵兽拥有权、资源、天赋或解锁格；导入后仍需阵容相同、完整占格已解锁才能应用。
      </p>
      <button
        className="secondary"
        disabled={!preset}
        onClick={() => {
          if (!preset) return;
          try {
            setExportText(createFormationShare(preset));
            setCopyNotice('已生成，可复制或在文本框中手动全选复制。');
          } catch {
            setCopyNotice('当前预设无法生成分享码，请检查或重新保存。');
          }
        }}
      >
        生成阵型{slot + 1}分享码
      </button>
      {!preset && <p>当前槽位未保存，可切换到已有阵型生成，或在下方粘贴导入。</p>}
      {exportText && (
        <>
          <label htmlFor="formation-share-export">完整阵型分享码（可手动全选复制）</label>
          <textarea id="formation-share-export" readOnly value={exportText} spellCheck={false} />
          <button
            className="secondary"
            onClick={async () => {
              setCopyNotice('正在复制；也可在文本框中手动全选复制。');
              try {
                await navigator.clipboard.writeText(exportText);
                setCopyNotice('已复制完整阵型分享码。');
              } catch {
                setCopyNotice('自动复制不可用，请在文本框中手动全选复制。');
              }
            }}
          >
            复制阵型分享码
          </button>
        </>
      )}
      {copyNotice && <p role="status">{copyNotice}</p>}
      <label htmlFor="formation-share-import">粘贴完整阵型分享码（最大8KiB）</label>
      <textarea
        ref={importRef}
        id="formation-share-import"
        value={importText}
        spellCheck={false}
        placeholder="粘贴后先校验与预览，确认前不会保存"
        onChange={(event) => {
          setImportText(event.target.value);
          setPreview(null);
          setNotice('');
        }}
      />
      {blocked && <p>预设存储当前不可用，请先使用上方“重试读取预设”；原数据保留。</p>}
      <button
        className="secondary"
        disabled={blocked || !importText.trim()}
        onClick={() => {
          const result = inspectFormationShare(importText);
          setPreview(result.ok ? result.preset : null);
          setNotice(result.ok ? '校验通过，请核对下方阵型，确认后才会保存。' : result.error);
        }}
      >
        校验分享码
      </button>
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <section className="formation-share-preview" aria-label="待导入阵型预览">
          <h3>
            待导入 · {preview.units.filter((unit) => unit.position).length}只上阵 ·{' '}
            {preview.units.filter((unit) => !unit.position).length}只备战
          </h3>
          <PresetBoard preset={preview} />
          <p>
            {preset ? `将覆盖阵型${slot + 1}的原站位。` : `将保存到空槽阵型${slot + 1}。`}
            只保存预设，不自动应用到当前阵容。
            {isolated && '仅本次试玩，刷新清空。'}
          </p>
          <button
            className="primary"
            disabled={blocked}
            onClick={() => {
              const error = onImport(preview);
              if (error) {
                setNotice(error);
                return;
              }
              setPreview(null);
              setImportText('');
              setExportText('');
              setCopyNotice('');
              setNotice(
                `已导入到阵型${slot + 1}，当前阵容未移动。${isolated ? '仅本次试玩，刷新清空。' : ''}`,
              );
              importRef.current?.focus();
            }}
          >
            确认导入到阵型{slot + 1}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setPreview(null);
              setNotice('已取消导入，预设与当前阵容未改变。');
              importRef.current?.focus();
            }}
          >
            取消导入阵型
          </button>
        </section>
      )}
    </div>
  );
}

export function FormationShare(props: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="formation-share"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>阵型分享码 · 复制与导入</summary>
      {expanded && <ShareContent {...props} />}
    </details>
  );
}
