import { describe, expect, it, vi } from 'vitest';
import { GameAudio, SOUND_PREFERENCE_KEY } from './game-audio';
import { MUSIC_PREFERENCE_KEY } from './game-music';

function setup(initial = 'on', music = 'off') {
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
        cancelScheduledValues: vi.fn(),
        setTargetAtTime: vi.fn(),
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
  const storage = {
    getItem: vi.fn((key: string) => (key === MUSIC_PREFERENCE_KEY ? music : initial)),
    setItem: vi.fn(),
  };
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

describe('独立背景音乐与共享音频生命周期', () => {
  it('默认音乐关；保存为开也等待手势，不因展示更新创建上下文', () => {
    const s = setup();
    expect(s.audio.music.enabled).toBe(false);
    s.audio.updateMusic('prepare');
    expect(s.factory).not.toHaveBeenCalled();
    const saved = setup('off', 'on');
    saved.audio.updateMusic('combat');
    expect(saved.factory).not.toHaveBeenCalled();
    saved.audio.unlock();
    saved.audio.updateMusic('combat');
    expect(saved.factory).toHaveBeenCalledTimes(1);
    expect(saved.oscillators).toHaveLength(2);
  });

  it('音效关可独立开音乐，关闭音乐不改音效偏好，也不截断短音', () => {
    const s = setup('off');
    s.audio.setMusicEnabled(true);
    expect(s.storage.setItem).toHaveBeenCalledWith(MUSIC_PREFERENCE_KEY, 'on');
    expect(s.audio.enabled).toBe(false);
    s.audio.unlock();
    s.audio.updateMusic('prepare');
    s.audio.play('attack');
    expect(s.oscillators).toHaveLength(2);
    s.audio.setEnabled(true);
    s.audio.play('deploy');
    const cue = s.oscillators[2];
    s.audio.setMusicEnabled(false);
    expect(cue.stop).toHaveBeenCalledTimes(1); // Only its original scheduled end.
    expect(s.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.008);
    expect(s.audio.enabled).toBe(true);
    s.context.currentTime = 2;
    s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(3);
  });

  it('音乐两种曲目节奏不同；同一节拍不重复，切曲淡出旧声并从首拍开始', () => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.audio.updateMusic('prepare');
    for (let i = 0; i < 20; i++) s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(2);
    s.context.currentTime = 0.61; // Preparation phrase's second beat is a rest.
    s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(2);
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(4);
    expect(s.oscillators[0].stop).toHaveBeenLastCalledWith(0.65);
    s.oscillators.slice(0, 2).forEach((o) => o.onended?.());
    s.context.currentTime = 1.02;
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(5);
    expect(s.oscillators[4].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(392, 0);
  });

  it('暂停与后台立即短淡出，不重复停止；恢复及长卡顿不补播旧拍', () => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.audio.updateMusic('combat');
    s.audio.suspend();
    s.audio.updateMusic(null);
    expect(s.gains[0].gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    s.oscillators.slice().forEach((o) => o.onended?.());
    s.context.currentTime = 30;
    s.audio.updateMusic(null);
    expect(s.oscillators).toHaveLength(2);
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(4);
    s.context.currentTime = 90;
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(5);
    s.hide();
    s.audio.updateMusic('combat');
    expect(s.gains[4].gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('异步解锁期间静音/暂停不会排队，resume完成后仍以当前状态为准', async () => {
    const s = setup('off', 'on');
    s.context.state = 'suspended';
    let finishResume!: () => void;
    s.context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishResume = () => {
            s.context.state = 'running';
            resolve();
          };
        }),
    );
    s.audio.unlock();
    s.audio.updateMusic('combat');
    s.audio.setMusicEnabled(false);
    finishResume();
    await Promise.resolve();
    await Promise.resolve();
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(0);
    s.audio.setMusicEnabled(true);
    s.audio.updateMusic(null);
    expect(s.oscillators).toHaveLength(0);
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(2);
  });

  it('最多六个音乐节点，结束释放后可继续；关键短音不截断音乐', () => {
    const s = setup('on', 'on');
    s.audio.unlock();
    for (let i = 0; i < 50; i++) {
      s.context.currentTime = i;
      s.audio.updateMusic('combat');
    }
    expect(s.oscillators).toHaveLength(6);
    s.audio.play('warning');
    expect(s.oscillators).toHaveLength(8);
    expect(s.oscillators[0].disconnect).not.toHaveBeenCalled();
    s.oscillators[0].onended?.();
    s.context.currentTime = 51;
    s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(9);
    s.audio.dispose();
    expect(s.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
    s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(9);
    expect(s.context.close).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('部分音乐节点创建失败清理全部资源，已有音乐声部=%s', (partial) => {
    const s = setup('on', 'on');
    s.audio.unlock();
    if (partial)
      s.context.createGain.mockImplementationOnce(s.context.createGain.getMockImplementation()!);
    s.context.createGain.mockImplementationOnce(() => {
      throw new Error('failed');
    });
    expect(() => s.audio.updateMusic('prepare')).not.toThrow();
    expect(s.audio.unavailable).toBe(true);
    expect(s.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
    expect(s.oscillators.at(-1)!.start).not.toHaveBeenCalled();
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(partial ? 2 : 1);
  });

  it('音乐播放中短音节点失败，也释放共享上下文上的音乐节点', () => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.audio.updateMusic('combat');
    s.context.createOscillator.mockImplementationOnce(() => {
      throw new Error('failed');
    });
    expect(() => s.audio.play('attack')).not.toThrow();
    expect(s.audio.unavailable).toBe(true);
    expect(s.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
  });
});
