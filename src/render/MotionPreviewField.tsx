import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MousePreviewClock, type MouseAction } from '../presentation/mouse-preview-clock';
import { ArtLayer } from './ArtLayer';
import { mouseAnimationUrl, mouseMotionArt } from './character-art';

export type MotionPreviewStatus = { missing: MouseAction[]; error?: string };
type Props = {
  clock: MousePreviewClock;
  onChange: () => void;
  onStatus: (status: MotionPreviewStatus) => void;
  light: boolean;
};

export function MotionPreviewField({ clock, onChange, onStatus, light }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const background = useRef(light);
  background.current = light;
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let resetDelta = true;
    let lastView = '';
    const density = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const reset = () => {
      resetDelta = true;
    };
    window.addEventListener('focus', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    class PreviewScene extends Phaser.Scene {
      private art!: ArtLayer;
      private guides!: Phaser.GameObjects.Graphics;
      preload() {
        this.load.maxRetries = 0;
        for (const art of Object.values(mouseMotionArt))
          this.load.spritesheet(
            art.key,
            mouseAnimationUrl(art.file),
            {
              frameWidth: art.frameWidth,
              frameHeight: art.frameHeight,
              endFrame: art.frames - 1,
            },
            { responseType: 'blob', timeout: 8000 },
          );
      }
      create() {
        this.cameras.main.setZoom(density).centerOn(180, 165);
        this.art = new ArtLayer(this);
        this.guides = this.add.graphics();
        if (!disposed)
          onStatus({
            missing: (Object.keys(mouseMotionArt) as MouseAction[]).filter(
              (action) => !this.textures.exists(mouseMotionArt[action].key),
            ),
          });
      }
      update(_time: number, delta: number) {
        if (disposed || !this.art) return;
        const view = clock.snapshot();
        const present = this.textures.exists(mouseMotionArt[view.action].key);
        if (!present && view.playing) clock.toggle();
        clock.advance(resetDelta ? 0 : delta, !document.hidden && document.hasFocus() && present);
        resetDelta = false;
        const current = clock.snapshot();
        const key = JSON.stringify(current);
        if (key !== lastView) {
          lastView = key;
          onChange();
        }
        this.cameras.main.setBackgroundColor(background.current ? '#e4decc' : '#16362b');
        const color = background.current ? 0x556951 : 0xa8b693;
        const g = this.guides;
        g.clear().lineStyle(1, color, 0.3);
        // Game-scale and enlarged views keep the same shared foot baseline.
        for (const [cx, cy, factor] of [
          [80, 70, 1],
          [180, 210, 4],
        ]) {
          const size = 52 * factor;
          g.strokeRect(cx - size / 2, cy - size / 2, size, size);
          g.lineStyle(1, color, 0.5).lineBetween(
            cx - size / 2,
            cy + (107 / 6) * factor,
            cx + size / 2,
            cy + (107 / 6) * factor,
          );
        }
        this.art.begin();
        const art = mouseMotionArt[current.action];
        if (present) {
          this.art.draw(art.key, 80, 70, 42, 36, 2, 1, 0xffffff, 0, current.frame);
          this.art.draw(art.key, 180, 210, 168, 144, 2, 1, 0xffffff, 0, current.frame);
        }
        // The shipped attack's first pose is a stable alignment reference in the small view.
        this.art.draw(mouseMotionArt.attack.key, 240, 70, 42, 36, 2, 0.45);
        this.art.end();
      }
    }
    let game: Phaser.Game | undefined;
    try {
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host.current,
        width: 360 * density,
        height: 330 * density,
        backgroundColor: '#16362b',
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: PreviewScene,
      });
    } catch {
      onStatus({ missing: [], error: '动作画布初始化失败，请重新加载。' });
    }
    return () => {
      disposed = true;
      window.removeEventListener('focus', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      game?.destroy(true);
    };
  }, [clock, onChange, onStatus]);
  return (
    <div
      className="motion-preview-field"
      ref={host}
      role="img"
      aria-label="烬灵鼠当前动作：上方为战场比例和攻击首帧参考，下方为四倍放大及脚底基准线"
    />
  );
}
