import type { RendererRecoveryState } from '../render/renderer-recovery';
import type { Session } from '../game/session';

export function RendererRecoveryDialog({
  state,
  phase,
  isolated,
}: {
  state: NonNullable<RendererRecoveryState>;
  phase: Session['phase'];
  isolated: boolean;
}) {
  let reloadNote = '重新加载会恢复最近保存的关卡进度。';
  if (phase === 'prepare') reloadNote = '重新加载会恢复最近保存的布阵。';
  if (phase === 'combat')
    reloadNote = '重新加载会回到开战前布阵，本关未结算的灵钱、经验和天赋不保留。';
  if (isolated) reloadNote = '当前是隔离试玩；重新加载会重置临时试玩进度，不影响正式存档。';
  let reloadLabel = phase === 'combat' ? '重新加载，回到布阵' : '重新加载页面';
  if (isolated) reloadLabel = '重新加载试玩';
  return (
    <div className="modal-backdrop renderer-recovery">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="renderer-recovery-title"
        aria-describedby="renderer-recovery-description"
      >
        <span className="eyebrow">战场画面恢复</span>
        <h2 id="renderer-recovery-title">
          {state === 'lost' ? '战场画面暂时中断' : '正在恢复战场画面'}
        </h2>
        <p id="renderer-recovery-description" role="status">
          {state === 'lost'
            ? '游戏已停止等待，不会继续出怪或结算伤害。正在等待设备恢复画面。'
            : '画面恢复后此提示会自动关闭。守卫仍保持暂停，点击继续后再战。'}
        </p>
        <p>如果一直没有恢复，可以重新加载。</p>
        <p>{reloadNote}</p>
        <button className="secondary" onClick={() => window.location.reload()}>
          {reloadLabel}
        </button>
      </section>
    </div>
  );
}
