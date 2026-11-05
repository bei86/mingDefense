import { useCallback, useEffect, useState } from 'react';
import { MousePreviewClock, type MouseAction } from '../presentation/mouse-preview-clock';
import { MotionPreviewField, type MotionPreviewStatus } from '../render/MotionPreviewField';
import { playtestUrl } from './playtest-scenes';
import './motion-preview.css';

const actions: { id: MouseAction; label: string }[] = [
  { id: 'idle', label: '待机' },
  { id: 'attack', label: '攻击' },
  { id: 'hurt', label: '受击' },
  { id: 'fallen', label: '重伤' },
];

export function MotionPreview({ pathname }: { pathname: string }) {
  const [clock] = useState(() => new MousePreviewClock());
  const [view, setView] = useState(() => clock.snapshot());
  const [status, setStatus] = useState<MotionPreviewStatus | null>(null);
  const [light, setLight] = useState(false);
  const [userReduced, setUserReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const publish = useCallback(() => setView(clock.snapshot()), [clock]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setSystemReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    clock.setReduced(userReduced || systemReduced);
    publish();
  }, [clock, userReduced, systemReduced, publish]);

  const missing = status?.missing.includes(view.action) ?? false;
  const disabled = status === null || !!status.error || missing;
  const noPlayback = disabled || view.reduced;
  const label = actions.find((entry) => entry.id === view.action)!.label;
  function change(action: () => void) {
    action();
    publish();
  }

  return (
    <main className="motion-preview" aria-labelledby="motion-preview-title">
      <header>
        <span className="eyebrow">仅开发版 · 动作检查</span>
        <h1 id="motion-preview-title">烬灵鼠动作预览</h1>
        <p>
          独立查看素材，不读取或写入战役进度。这里只检查动作帧，真实攻击时机请进入八灵实战对照。
        </p>
      </header>
      <section className="motion-preview-surface" aria-label="动作画面">
        <MotionPreviewField clock={clock} onChange={publish} onStatus={setStatus} light={light} />
        <p className="motion-preview-caption">
          上方：战场比例（52逻辑像素/格），右侧为攻击首帧参考；下方：4倍放大。横线为共同脚底基准。
        </p>
      </section>
      <p role={status?.error || missing ? 'alert' : 'status'} className="motion-preview-status">
        {status === null && '正在加载四组动作素材…'}
        {status?.error}
        {status &&
          !status.error &&
          status.missing.length > 0 &&
          `缺少素材：${actions
            .filter((action) => status.missing.includes(action.id))
            .map((action) => action.label)
            .join('、')}。请选择其他动作或重新加载。`}
        {status &&
          !status.error &&
          status.missing.length === 0 &&
          '四组素材已加载，可播放或逐帧检查。'}
      </p>
      {status && (status.error || status.missing.length > 0) && <a href="">重新加载素材</a>}
      <section className="motion-preview-controls" aria-label="动作播放控件">
        <div className="motion-preview-actions" role="group" aria-label="选择动作">
          {actions.map((action) => (
            <button
              key={action.id}
              aria-pressed={view.action === action.id}
              onClick={() => change(() => clock.select(action.id))}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="motion-preview-row">
          <button
            className="motion-preview-play"
            disabled={noPlayback}
            onClick={() => change(() => clock.toggle())}
          >
            {view.playing ? '暂停' : '播放'}
          </button>
          <button disabled={noPlayback} onClick={() => change(() => clock.replay())}>
            重播
          </button>
          <button
            disabled={noPlayback || view.frame === 0}
            onClick={() => change(() => clock.step(-1))}
          >
            上一帧
          </button>
          <button
            disabled={noPlayback || view.frame === view.count - 1}
            onClick={() => change(() => clock.step(1))}
          >
            下一帧
          </button>
        </div>
        <label htmlFor="motion-preview-frame">
          {label} · 第{' '}
          <span aria-live="off">
            {view.frame + 1} / {view.count}
          </span>{' '}
          帧
        </label>
        <input
          id="motion-preview-frame"
          type="range"
          min="0"
          max={view.count - 1}
          value={view.frame}
          disabled={noPlayback}
          aria-valuetext={`第${view.frame + 1}帧，共${view.count}帧`}
          onChange={(event) => change(() => clock.seek(Number(event.currentTarget.value)))}
        />
        <div className="motion-preview-options">
          <label>
            播放速度
            <select
              value={view.speed}
              onChange={(event) =>
                change(() => {
                  clock.speed = event.currentTarget.value === '2' ? 2 : 1;
                })
              }
            >
              <option value="1">1倍</option>
              <option value="2">2倍</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={userReduced || systemReduced}
              disabled={systemReduced}
              onChange={(event) => setUserReduced(event.currentTarget.checked)}
            />
            减少动态
          </label>
          <label>
            <input
              type="checkbox"
              checked={light}
              onChange={(event) => setLight(event.currentTarget.checked)}
            />
            浅色背景
          </label>
        </div>
        <p>
          {view.action === 'idle'
            ? '待机循环播放。'
            : '当前动作播放一次后停在末帧，点击重播可重新查看。'}
          {view.action === 'attack' && '攻击预览按每帧70ms顺播，不模拟战斗前摇和火球释放。'}
          {view.reduced && '减少动态已启用：动作固定首帧，重伤固定末帧。'}
          {systemReduced && '当前跟随系统减少动态设置。'}
        </p>
      </section>
      <nav aria-label="离开动作预览">
        <a href={playtestUrl('mouse-combat', false, pathname)!}>进入烬灵鼠实战对照</a>
        <a href={playtestUrl('roster', false, pathname)!}>进入八灵实战对照</a>
        <a href={pathname}>返回正式战役</a>
      </nav>
      <p className="motion-preview-note">
        返回正式战役后按原检查点载入；预览中的动作和倍速不会带入战役。切换标签页或失焦时暂停计时，恢复后不补跑。
      </p>
    </main>
  );
}
