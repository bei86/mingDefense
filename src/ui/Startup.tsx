import { Component, lazy, Suspense, type PropsWithChildren } from 'react';
import { motionPreviewRequested } from './motion-preview-route';

const GameApp = lazy(() => import('./App').then((module) => ({ default: module.App })));
const MotionPreview = import.meta.env.DEV
  ? lazy(() => import('./MotionPreview').then((module) => ({ default: module.MotionPreview })))
  : null;

function StartupScreen({ failed = false }: { failed?: boolean }) {
  return (
    <main className="startup-screen" aria-labelledby="startup-title">
      <section className="startup-panel">
        <div className="startup-mark" aria-hidden="true">
          林
        </div>
        <p className="startup-eyebrow">MING DEFENSE</p>
        <h1 id="startup-title">灵林守阵</h1>
        <p className="startup-status" role={failed ? 'alert' : 'status'}>
          {!failed && <span className="startup-pulse" aria-hidden="true" />}
          {failed ? '游戏加载遇到问题' : '正在准备灵兽与战场…'}
        </p>
        <p className="startup-note">
          {failed
            ? '请检查网络后重新加载。本地存档会保留，战斗从开战前检查点恢复。'
            : '首次进入需要片刻。长时间未进入时，可尝试重新加载。'}
        </p>
        <a className="startup-reload" href="">
          重新加载
        </a>
      </section>
    </main>
  );
}

class StartupBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <StartupScreen failed />;
    return this.props.children;
  }
}

export function Startup() {
  const preview =
    MotionPreview &&
    typeof window !== 'undefined' &&
    motionPreviewRequested(window.location.search, import.meta.env.DEV);
  return (
    <StartupBoundary>
      <Suspense fallback={<StartupScreen />}>
        {preview && MotionPreview ? (
          <MotionPreview pathname={window.location.pathname} />
        ) : (
          <GameApp />
        )}
      </Suspense>
    </StartupBoundary>
  );
}
