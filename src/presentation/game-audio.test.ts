import { describe, expect, it, vi } from 'vitest';
import { GameAudio, SOUND_PREFERENCE_KEY } from './game-audio';
import { MUSIC_PREFERENCE_KEY } from './game-music';
import { combatSoundCues } from './sound-cues';
import { MUSIC_VOLUME_KEY, SOUND_VOLUME_KEY } from './audio-volume';

function setup(initial = 'on', music = 'off', levels: Record<string, string> = {}) {
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
    getItem: vi.fn((key: string) => {
      if (key === MUSIC_PREFERENCE_KEY) return music;
      if (key === SOUND_PREFERENCE_KEY) return initial;
      return levels[key] ?? null;
    }),
    setItem: vi.fn(),
  };
  let hidden = false;
  const audio = new GameAudio({ context: factory, storage: () => storage, hidden: () => hidden });
  return {
    audio,
    context,
    factory,
    oscillators,
    // Envelope nodes are the targets of oscillator connections; channel buses are separate.
    get gains() {
      return oscillators.flatMap((node) => node.connect.mock.calls.map((call) => call[0]));
    },
    allGains: gains,
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

describe('灵兽战斗音色与共享声量预算', () => {
  it('不同技能与敌方攻击共享140ms，不因切换种类绕过冷却', () => {
    const s = setup();
    s.audio.unlock();
    s.audio.play('mouse_attack');
    expect(s.oscillators).toHaveLength(2);
    s.context.currentTime = 0.05;
    s.audio.play('fox_shield');
    s.context.currentTime = 0.1;
    s.audio.play('attack');
    expect(s.oscillators).toHaveLength(2);
    s.context.currentTime = 0.15;
    s.audio.play('boar_attack');
    expect(s.oscillators).toHaveLength(4);
  });

  it('同次采样多种技能轮换，不排队；被冷却丢弃不推进轮换位置', () => {
    const s = setup();
    s.audio.unlock();
    const play = vi.spyOn(s.audio, 'play');
    const cues = [...combatSoundCues];
    s.audio.playFeedback(cues);
    expect(play).toHaveBeenLastCalledWith('mouse_attack');
    s.context.currentTime = 0.05;
    s.audio.playFeedback(cues);
    expect(play).toHaveBeenLastCalledWith('boar_attack');
    expect(s.oscillators).toHaveLength(2);
    for (const [index, cue] of combatSoundCues.entries()) {
      if (!index) continue;
      s.oscillators.forEach((node) => node.onended?.());
      s.context.currentTime = index * 0.2;
      const count = s.oscillators.length;
      s.audio.playFeedback(cues);
      expect(play).toHaveBeenLastCalledWith(cue);
      expect(s.oscillators.length).toBeGreaterThan(count);
    }
    const count = s.oscillators.length;
    s.context.currentTime = 10;
    s.audio.playFeedback([]);
    expect(s.oscillators).toHaveLength(count);
  });

  it('首领/横扫/升级/结果优先于技能，保护到最后一音结束', () => {
    for (const cue of ['boss', 'phase', 'warning', 'levelup', 'victory', 'defeat'] as const) {
      const s = setup();
      s.audio.unlock();
      s.audio.playFeedback(['mouse_attack', 'fox_shield', cue]);
      const count = s.oscillators.length;
      expect(count).toBeGreaterThan(0);
      s.context.currentTime = 0.1;
      s.audio.play('boar_attack');
      s.audio.play('click');
      expect(s.oscillators).toHaveLength(count);
      s.context.currentTime = 1;
      s.audio.play('boar_attack');
      expect(s.oscillators).toHaveLength(count + 2);
    }
  });

  it('新音色遵循静音、不可见、暂停清理和音乐独立，解禁不会补播', () => {
    const s = setup('off', 'on');
    s.audio.unlock();
    s.audio.playFeedback(['fox_shield']);
    expect(s.oscillators).toHaveLength(0);
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(2);
    s.audio.setEnabled(true);
    s.audio.playFeedback([]);
    expect(s.oscillators).toHaveLength(2);
    s.audio.play('fox_shield');
    expect(s.oscillators).toHaveLength(4);
    expect(s.oscillators[0].disconnect).not.toHaveBeenCalled();
    s.audio.suspend();
    expect(s.oscillators[2].disconnect).toHaveBeenCalledOnce();
    expect(s.oscillators[3].disconnect).toHaveBeenCalledOnce();
    s.hide();
    s.context.currentTime = 5;
    s.audio.play('eagle_attack');
    expect(s.oscillators).toHaveLength(4);
  });

  it('双声部攻击仍受12节点限制，结束可再用；关键提示释放旧节点', () => {
    const s = setup();
    s.audio.unlock();
    for (let i = 0; i < 20; i++) {
      s.context.currentTime = i * 0.2;
      s.audio.play('monkey_attack');
    }
    expect(s.oscillators).toHaveLength(12);
    s.oscillators[0].onended?.();
    s.oscillators[1].onended?.();
    s.context.currentTime = 5;
    s.audio.play('bear_attack');
    expect(s.oscillators).toHaveLength(14);
    s.context.currentTime = 6;
    s.audio.play('warning');
    expect(s.oscillators).toHaveLength(16);
    expect(s.oscillators.slice(0, 14).every((o) => o.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it.each([0, 1])('创建第%s个增益失败，已创建振荡器也释放，安静降级', (successful) => {
    const s = setup();
    s.audio.unlock();
    const makeGain = s.context.createGain.getMockImplementation()!;
    s.context.createGain.mockImplementationOnce(makeGain); // Channel bus precedes envelopes.
    for (let i = 0; i < successful; i++) s.context.createGain.mockImplementationOnce(makeGain);
    s.context.createGain.mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
    expect(() => s.audio.play('mouse_attack')).not.toThrow();
    expect(s.audio.unavailable).toBe(true);
    expect(s.oscillators).toHaveLength(successful + 1);
    expect(s.oscillators.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    expect(s.gains.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    s.context.currentTime = 5;
    s.audio.play('eagle_attack');
    expect(s.oscillators).toHaveLength(successful + 1);
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
    s.context.createGain.mockImplementationOnce(s.context.createGain.getMockImplementation()!);
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

describe('两路音量接入真实播放路径', () => {
  it('保留旧开关，音量调整仅写自己的键，不创建或解锁音频', () => {
    const s = setup('off', 'on', { [SOUND_VOLUME_KEY]: '35', [MUSIC_VOLUME_KEY]: '20' });
    expect(s.audio.volume).toBe(35);
    expect(s.audio.music.volume).toBe(20);
    s.audio.setVolume(40);
    s.audio.setMusicVolume(15);
    expect(s.storage.setItem.mock.calls).toEqual([
      [SOUND_VOLUME_KEY, '40'],
      [MUSIC_VOLUME_KEY, '15'],
    ]);
    expect(s.audio.enabled).toBe(false);
    expect(s.audio.music.enabled).toBe(true);
    expect(s.factory).not.toHaveBeenCalled();
    expect(s.allGains).toHaveLength(0);
  });

  it('包络接到各自总线，实时滑杆不改变另一通道、包络或声部数量', () => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.audio.play('deploy');
    s.audio.updateMusic('prepare');
    const buses = s.allGains.filter((g) => g.connect.mock.calls[0]?.[0] === s.context.destination);
    expect(buses).toHaveLength(2);
    expect(s.gains[0].connect).toHaveBeenCalledWith(buses[0]);
    expect(s.gains[1].connect).toHaveBeenCalledWith(buses[1]);
    expect(s.gains[2].connect).toHaveBeenCalledWith(buses[1]);
    expect(buses[0].gain.setValueAtTime).toHaveBeenCalledWith(1, 0);
    s.context.currentTime = 0.05;
    s.audio.setVolume(25);
    expect(buses[0].gain.setTargetAtTime).toHaveBeenCalledWith(0.25, 0.05, 0.015);
    expect(buses[1].gain.setTargetAtTime).not.toHaveBeenCalled();
    s.audio.setMusicVolume(65);
    expect(buses[1].gain.setTargetAtTime).toHaveBeenCalledWith(0.65, 0.05, 0.015);
    expect(s.gains.every((g) => g.gain.setTargetAtTime.mock.calls.length === 0)).toBe(true);
    expect(s.oscillators).toHaveLength(3);
    s.audio.dispose();
    expect(s.allGains.every((g) => g.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it('两路零音量不创建上下文；恢复只播新事件，不排队也不改变开关', () => {
    const s = setup('on', 'on', { [SOUND_VOLUME_KEY]: '0', [MUSIC_VOLUME_KEY]: '0' });
    s.audio.unlock();
    s.audio.play('warning');
    s.audio.updateMusic('combat');
    expect(s.factory).not.toHaveBeenCalled();
    s.audio.setVolume(60);
    expect(s.factory).not.toHaveBeenCalled();
    s.audio.unlock();
    expect(s.oscillators).toHaveLength(0);
    s.audio.play('mouse_attack');
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(2);
    s.context.currentTime = 1;
    s.audio.setVolume(0);
    s.audio.play('fox_shield');
    expect(s.oscillators).toHaveLength(2);
    s.audio.setMusicVolume(40);
    s.audio.updateMusic(null); // Paused settings never start a new phrase.
    expect(s.oscillators).toHaveLength(2);
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(4);
    expect(s.audio.enabled).toBe(true);
    expect(s.audio.music.enabled).toBe(true);
    expect(s.storage.setItem.mock.calls.every(([key]) => key.endsWith('-volume'))).toBe(true);
  });

  it('关闭音效后滑杆不偷开，音乐仍可播放；后台和暂停音量调整不生成声部', () => {
    const s = setup('off', 'on');
    s.audio.setVolume(55);
    s.audio.unlock();
    s.audio.play('deploy');
    s.audio.updateMusic('prepare');
    expect(s.oscillators).toHaveLength(2);
    s.audio.suspend();
    s.audio.setMusicVolume(30);
    s.audio.setVolume(80);
    s.audio.updateMusic(null);
    expect(s.oscillators).toHaveLength(2);
    s.hide();
    s.audio.updateMusic('combat');
    expect(s.oscillators).toHaveLength(2);
    expect(s.audio.enabled).toBe(false);
  });

  it.each(['sound', 'music'])('%s总线创建失败安静降级，未留下半创建声部', (channel) => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.context.createGain.mockImplementationOnce(() => {
      throw new Error('bus');
    });
    expect(() =>
      channel === 'sound' ? s.audio.play('deploy') : s.audio.updateMusic('prepare'),
    ).not.toThrow();
    expect(s.audio.unavailable).toBe(true);
    expect(s.oscillators).toHaveLength(0);
    expect(s.allGains).toHaveLength(0);
  });

  it.each(['sound', 'music'])('%s实时增益失败时清理两路总线和全部声部', (channel) => {
    const s = setup('on', 'on');
    s.audio.unlock();
    s.audio.play('deploy');
    s.audio.updateMusic('prepare');
    const buses = s.allGains.filter((g) => g.connect.mock.calls[0]?.[0] === s.context.destination);
    buses[channel === 'sound' ? 0 : 1].gain.setTargetAtTime.mockImplementationOnce(() => {
      throw new Error('gain');
    });
    expect(() =>
      channel === 'sound' ? s.audio.setVolume(10) : s.audio.setMusicVolume(10),
    ).not.toThrow();
    expect(s.audio.unavailable).toBe(true);
    expect(s.allGains.every((g) => g.disconnect.mock.calls.length === 1)).toBe(true);
    expect(s.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
  });
});
