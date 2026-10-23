export type RendererRecoveryState = 'lost' | 'restoring' | null;

type FrameSource = {
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
  contextLost?: boolean;
};

/** Wait for the renderer's frame, never the Game's frame (which also fires while WebGL is lost). */
export class RendererRecovery {
  private sceneReady = false;
  private ready = false;
  private disposed = false;
  private state: RendererRecoveryState = null;
  private detach: (() => void) | undefined;

  constructor(
    private onReady: (ready: boolean) => void,
    private onRecovery: (state: RendererRecoveryState) => void,
  ) {}

  attach(canvas: EventTarget, renderer: FrameSource): void {
    if (this.disposed || this.detach) return;
    const lost = (event: Event) => {
      event.preventDefault();
      this.ready = false;
      this.onReady(false);
      this.setState('lost');
    };
    const restored = () => {
      // Phaser installs its listener first and restores resources before ours runs.
      if (this.state === 'lost' && !renderer.contextLost) this.setState('restoring');
    };
    const frame = () => {
      if (this.disposed || !this.sceneReady || this.ready || this.state === 'lost') return;
      if (renderer.contextLost) return;
      this.ready = true;
      this.onReady(true);
      this.setState(null);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    renderer.on('postrender', frame);
    this.detach = () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      renderer.off('postrender', frame);
    };
    if (renderer.contextLost) lost(new Event('webglcontextlost'));
  }

  created(): void {
    if (!this.disposed) this.sceneReady = true;
  }

  dispose(): void {
    this.disposed = true;
    this.detach?.();
  }

  private setState(state: RendererRecoveryState): void {
    if (this.state === state) return;
    this.state = state;
    this.onRecovery(state);
  }
}
