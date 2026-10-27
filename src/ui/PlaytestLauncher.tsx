import { useState } from 'react';
import type { Phase } from '../game/session';
import { playtestScenes, playtestUrl } from './playtest-scenes';
import './playtest-launcher.css';

type Props = {
  pathname: string;
  phase: Phase;
  isolated: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
};

const returnLabels: Record<Phase, string> = {
  prepare: '返回布阵',
  combat: '返回暂停菜单',
  victory: '返回结算',
  defeat: '返回结算',
};

export function PlaytestLauncher({ pathname, phase, isolated, onClose, onNavigate }: Props) {
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
          离开当前页面将放弃未保存操作和临时试玩进度。需要保留进度或报告请先导出。
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
        {isolated && (
          <>
            <p id="playtest-return-note">
              返回时读取正式战役的现有检查点，无存档则按正常流程开始新局。不会把试玩阵容带入正式战役。
            </p>
            <button
              className="secondary"
              aria-describedby="playtest-return-note playtest-leave"
              onClick={() => onNavigate(pathname)}
            >
              返回正式战役
            </button>
          </>
        )}
        <button className="secondary" onClick={onClose}>
          {returnLabels[phase]}
        </button>
      </section>
    </div>
  );
}
