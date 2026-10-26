import { useEffect, useId, useRef, useState } from 'react';
import { copyReportText } from './report-copy';
import './report-export.css';

type TextExportProps = {
  text: string;
  label: string;
  copyLabel: string;
  copiedNotice: string;
  download?: { label: string; run: () => string };
  onCollect?: () => string;
};

export function TextExport(props: TextExportProps) {
  return <TextExportContent key={props.text} {...props} />;
}

function TextExportContent({
  text,
  label,
  copyLabel,
  copiedNotice,
  download,
  onCollect,
}: TextExportProps) {
  const textId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingCopy = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState('');
  const [copying, setCopying] = useState(false);
  useEffect(
    () => () => {
      pendingCopy.current?.abort();
      pendingCopy.current = null;
    },
    [],
  );

  function cancelCopy(): void {
    const pending = pendingCopy.current;
    pendingCopy.current = null;
    pending?.abort();
    setCopying(false);
  }

  return (
    <div className="report-text">
      {onCollect && (
        <button
          className="secondary collect-report"
          onClick={() => {
            cancelCopy();
            setNotice(onCollect());
          }}
        >
          收藏到本地
        </button>
      )}
      <div className="report-export-actions">
        <button
          className="secondary"
          disabled={copying}
          onClick={async () => {
            if (pendingCopy.current) return;
            const controller = new AbortController();
            pendingCopy.current = controller;
            setCopying(true);
            setNotice('正在复制；也可在下方文本框中手动全选复制。');
            const result = await copyReportText(text, controller.signal);
            if (pendingCopy.current !== controller) return;
            pendingCopy.current = null;
            setCopying(false);
            if (result === 'copied') setNotice(copiedNotice);
            else if (result === 'timeout')
              setNotice('复制结果尚未确认，请点击「选中文本」后手动复制；也可重试。');
            else setNotice('自动复制不可用，请点击「选中文本」后手动复制。');
          }}
        >
          {copying ? '正在复制…' : copyLabel}
        </button>
        {download && (
          <button
            className="secondary"
            onClick={() => {
              cancelCopy();
              setNotice(download.run());
            }}
          >
            {download.label}
          </button>
        )}
        <button
          className={download ? 'secondary select-report-text' : 'secondary'}
          aria-controls={textId}
          onClick={() => {
            cancelCopy();
            const field = textarea.current;
            if (!field) return;
            field.focus();
            field.select();
            field.setSelectionRange(0, field.value.length);
            setNotice('已选中全文。电脑按 Ctrl/Cmd+C，手机可长按文本后选择复制。');
          }}
        >
          选中文本
        </button>
      </div>
      {notice && (
        <p role="status" className="report-export-notice">
          {notice}
        </p>
      )}
      <label htmlFor={textId}>{label}</label>
      <textarea ref={textarea} id={textId} readOnly value={text} spellCheck={false} />
    </div>
  );
}
