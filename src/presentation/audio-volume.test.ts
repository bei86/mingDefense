import { describe, expect, it, vi } from 'vitest';
import { AudioVolume, MUSIC_VOLUME_KEY, SOUND_VOLUME_KEY } from './audio-volume';

function store(saved: string | null = null) {
  return { getItem: vi.fn(() => saved), setItem: vi.fn() };
}

function context() {
  const gain = {
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const audio = {
    state: 'running',
    currentTime: 3,
    destination: {},
    createGain: vi.fn(() => gain),
  };
  return { gain, audio, context: audio as unknown as AudioContext };
}

describe('独立音量偏好与通道增益', () => {
  it.each([null, '', 'on', 'off', '-1', '101', 'NaN', 'Infinity', '0.5', '01', ' 50 ', '{}'])(
    '缺失/非法偏好%s回退原响度且不改写存储',
    (saved) => {
      const storage = store(saved);
      const volume = new AudioVolume(SOUND_VOLUME_KEY, () => storage);
      expect(volume.value).toBe(100);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '1', '50', '99', '100'])('合法偏好%s按原百分比读取', (saved) => {
    expect(new AudioVolume(SOUND_VOLUME_KEY, () => store(saved)).value).toBe(Number(saved));
  });

  it('只保存主动更改的有限整数，钳制上下界，不写另一通道', () => {
    const storage = store();
    const volume = new AudioVolume(MUSIC_VOLUME_KEY, () => storage);
    volume.set(49.6);
    expect(volume.value).toBe(50);
    volume.set(50);
    volume.set(NaN);
    volume.set(Infinity);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    volume.set(-20);
    expect(volume.value).toBe(0);
    volume.set(120);
    expect(volume.value).toBe(100);
    expect(storage.setItem.mock.calls).toEqual([
      [MUSIC_VOLUME_KEY, '50'],
      [MUSIC_VOLUME_KEY, '0'],
      [MUSIC_VOLUME_KEY, '100'],
    ]);
  });

  it('存储禁用时仍能调整当前页音量', () => {
    const volume = new AudioVolume(SOUND_VOLUME_KEY, () => {
      throw new Error('blocked');
    });
    expect(volume.value).toBe(100);
    expect(() => volume.set(25)).not.toThrow();
    expect(volume.value).toBe(25);
  });

  it('读写不分配音频；首次接线使用最新值，运行中平滑作用于同一总线，释放幂等', () => {
    const s = context();
    const volume = new AudioVolume(SOUND_VOLUME_KEY, () => store('70'));
    volume.set(30);
    expect(s.audio.createGain).not.toHaveBeenCalled();
    expect(volume.output(s.context)).toBe(s.gain);
    expect(volume.output(s.context)).toBe(s.gain);
    expect(s.audio.createGain).toHaveBeenCalledTimes(1);
    expect(s.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.3, 3);
    expect(s.gain.connect).toHaveBeenCalledWith(s.audio.destination);
    s.audio.currentTime = 4;
    volume.set(0);
    expect(s.gain.gain.cancelScheduledValues).toHaveBeenCalledWith(4);
    expect(s.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 4, 0.015);
    s.audio.state = 'closed';
    volume.set(80);
    expect(s.gain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    volume.dispose();
    volume.dispose();
    expect(s.gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it('总线接线失败仍可释放已分配增益，不影响另一通道', () => {
    const s = context();
    s.gain.connect.mockImplementationOnce(() => {
      throw new Error('connect');
    });
    const volume = new AudioVolume(SOUND_VOLUME_KEY, () => store());
    expect(() => volume.output(s.context)).toThrow('connect');
    volume.dispose();
    expect(s.gain.disconnect).toHaveBeenCalledTimes(1);
  });
});
