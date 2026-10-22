import { describe, expect, it, vi } from 'vitest';
import { GameAudio, SOUND_PREFERENCE_KEY } from './game-audio';

function setup(initial = 'on') {
  const oscillators: ReturnType<typeof oscillator>[] = [];
  function oscillator() {
    return {
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
      type: 'sine',
    };
  }
  const gains: ReturnType<typeof gain>[] = [];
  function gain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const node = oscillator();
      oscillators.push(node);
      return node;
    }),
    createGain: vi.fn(() => {
      const node = gain();
      gains.push(node);
      return node;
    }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const storage = { getItem: vi.fn(() => initial), setItem: vi.fn() };
  let hidden = false;
  const audio = new GameAudio({ context: factory, storage: () => storage, hidden: () => hidden });
  return {
    audio,
    context,
    factory,
    oscillators,
    gains,
    storage,
    hide: () => {
      hidden = true;
    },
  };
}

describe('本地合成短音', () => {
  it('手势恢复异步完成前不排队，恢复后只播放新事件且复用上下文', async () => {
    const s = setup();
    s.context.state = 'suspended';
    s.context.resume.mockImplementation(async () => {
      s.context.state = 'running';
    });
    s.audio.unlock();
    s.audio.unlock();
    expect(s.context.resume).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.oscillators).toHaveLength(0);
    s.audio.play('deploy');
    expect(s.oscillators).toHaveLength(1);
    expect(s.factory).toHaveBeenCalledTimes(1);
  });
  it('部署与合成反馈优先于刚播放的按钮音，不被全局节流吞掉', () => {
    const s = setup();
    s.audio.unlock();
    s.audio.play('click');
    s.context.currentTime = 0.025;
    s.audio.play('deploy');
    expect(s.oscillators).toHaveLength(2);
    expect(s.oscillators[0].disconnect).toHaveBeenCalledTimes(1);
    s.context.currentTime = 1;
    s.audio.play('click');
    s.context.currentTime = 1.025;
    s.audio.play('merge');
    expect(s.oscillators).toHaveLength(5);
  });
  it('只在手势解锁时创建音频，静音偏好保留，未解锁事件不排队', () => {
    const s = setup('off');
    s.audio.unlock();
    s.audio.play('merge');
    expect(s.factory).not.toHaveBeenCalled();
    s.audio.setEnabled(true);
    expect(s.storage.setItem).toHaveBeenCalledWith(SOUND_PREFERENCE_KEY, 'on');
    s.audio.unlock();
    expect(s.factory).toHaveBeenCalledTimes(1);
    expect(s.oscillators).toHaveLength(0);
    s.audio.play('merge');
    expect(s.oscillators).toHaveLength(2);
    expect(s.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(660, 0);
    expect(s.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.1);
    s.audio.setEnabled(false);
    expect(s.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
    s.context.currentTime = 1;
    s.audio.play('victory');
    expect(s.oscillators).toHaveLength(2);
  });

  it('每类与全局节流、最多12个振荡器，结束释放；关键提示优先，不积压攻击', () => {
    const s = setup();
    s.audio.unlock();
    s.audio.playFeedback(['attack', 'income', 'phase']);
    expect(s.oscillators).toHaveLength(2);
    s.audio.play('attack');
    expect(s.oscillators).toHaveLength(2);
    for (let i = 1; i <= 20; i++) {
      s.context.currentTime = i * 0.2;
      s.audio.play('attack');
    }
    expect(s.oscillators).toHaveLength(12);
    s.oscillators[0].onended?.();
    s.context.currentTime = 5;
    s.audio.play('attack');
    expect(s.oscillators).toHaveLength(13);
    s.context.currentTime = 6;
    s.audio.play('victory');
    expect(s.oscillators).toHaveLength(16);
    expect(s.oscillators[1].disconnect).toHaveBeenCalled();
    s.hide();
    s.context.currentTime = 7;
    s.audio.play('merge');
    expect(s.oscillators).toHaveLength(16);
  });

  it('存储失败不影响开关；AudioContext创建或恢复失败安静降级', async () => {
    const storage = () => {
      throw new Error('blocked');
    };
    const audio = new GameAudio({
      storage,
      context: () => {
        throw new Error('unsupported');
      },
    });
    expect(audio.enabled).toBe(true);
    expect(() => audio.setEnabled(false)).not.toThrow();
    audio.setEnabled(true);
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.unavailable).toBe(true);
    const s = setup();
    s.context.state = 'suspended';
    s.context.resume.mockRejectedValue(new Error('denied'));
    s.audio.unlock();
    s.audio.play('deploy');
    expect(s.oscillators).toHaveLength(0);
    await Promise.resolve();
    expect(s.audio.unavailable).toBe(true);
  });

  it('暂停停止当前声音，卸载关闭上下文，不再重新创建资源', () => {
    const s = setup();
    s.audio.unlock();
    s.audio.play('attack');
    s.audio.stop();
    expect(s.oscillators[0].stop).toHaveBeenCalledTimes(2);
    expect(s.gains[0].disconnect).toHaveBeenCalledTimes(1);
    s.audio.dispose();
    s.audio.unlock();
    s.audio.play('attack');
    expect(s.context.close).toHaveBeenCalledTimes(1);
    expect(s.factory).toHaveBeenCalledTimes(1);
    expect(s.oscillators).toHaveLength(1);
  });
});
