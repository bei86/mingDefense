import { useState } from 'react';
import { playtestScenes, playtestUrl } from './playtest-scenes';
import './playtest-launcher.css';

type Props = {
  pathname: string;
  paused: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
};

export function PlaytestLauncher({ pathname, paused, onClose, onNavigate }: Props) {
  const [sceneId, setSceneId] = useState<string>(playtestScenes[0].id);
  const [diagnostics, setDiagnostics] = useState(true);
  const scene = playtestScenes.find((entry) => entry.id === sceneId);
  const url = playtestUrl(sceneId, diagnostics, pathname);
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal playtest-launcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtest-title"
      >
        <span className="eyebrow">仅开发版 · 独立场景</span>
        <h2 id="playtest-title">开发试玩</h2>
        <label htmlFor="playtest-scene">选择试玩场景</label>
        <select
          id="playtest-scene"
          value={sceneId}
          aria-describedby="playtest-source"
          onChange={(event) => setSceneId(event.currentTarget.value)}
        >
          {playtestScenes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <p id="playtest-source" role="status">
          {scene?.description}
        </p>
        <label className="playtest-diagnostics">
          <input
            type="checkbox"
            checked={diagnostics}
            onChange={(event) => setDiagnostics(event.currentTarget.checked)}
          />
          开启性能诊断
        </label>
        <p>显示最近帧窗口并支持主动导出报告，读数不代表真机性能结论。</p>
        <p id="playtest-leave" className="playtest-leave">
          进入将离开当前页面，放弃未保存操作和临时试玩进度。需要保留进度或报告请先导出。
          所选试玩不会覆盖正式战役存档；正式战役仍按既有检查点恢复。
        </p>
        <button
          className="primary"
          disabled={!url}
          aria-describedby="playtest-leave"
          onClick={() => {
            if (url) onNavigate(url);
          }}
        >
          进入所选试玩
        </button>
        <button className="secondary" onClick={onClose}>
          {paused ? '返回暂停菜单' : '返回布阵'}
        </button>
      </section>
    </div>
  );
}
