import { describe, expect, it } from 'vitest';
import { Session } from '../game/session';
import { musicMood, GameMusic, MUSIC_PREFERENCE_KEY } from './game-music';

function deployed(): Session {
  const s = new Session();
  expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 2 }, { merge: s.preparation.units[0].id })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 })).toBeNull();
  return s;
}

describe('配乐展示状态与独立偏好', () => {
  it('实际开战/暂停/恢复/回整备映射正确，不因2倍速改变曲目', () => {
    const s = deployed();
    expect(musicMood(s)).toBe('prepare');
    expect(s.start()).toBeNull();
    expect(musicMood(s)).toBe('combat');
    s.pause(true);
    expect(musicMood(s)).toBeNull();
    s.pause(false);
    s.speed = 2;
    expect(musicMood(s)).toBe('combat');
    s.backToPreparation();
    expect(musicMood(s)).toBe('prepare');
  });

  it('真实战斗产生天赋后停播，选完才恢复；结算停播', () => {
    const s = deployed();
    s.start();
    for (let i = 0; i < 5000 && s.canAdvance; i++) s.tick();
    expect(s.hasChoices).toBe(true);
    expect(musicMood(s)).toBeNull();
    s.chooseBuff(s.battle!.choices[0]);
    expect(musicMood(s)).toBe('combat');
    for (let i = 0; i < 5000 && s.phase === 'combat'; i++) {
      if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
      else s.tick();
    }
    expect(s.phase).not.toBe('combat');
    expect(musicMood(s)).toBeNull();
  });

  it('读取只认可明确的on；存储被禁仍能开关，不依赖战役存储', () => {
    for (const value of [null, 'off', 'bad']) {
      expect(new GameMusic(() => ({ getItem: () => value, setItem() {} })).enabled).toBe(false);
    }
    const values = new Map([[MUSIC_PREFERENCE_KEY, 'on']]);
    const music = new GameMusic(() => ({
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    }));
    expect(music.enabled).toBe(true);
    music.setEnabled(false, null);
    expect(values.get(MUSIC_PREFERENCE_KEY)).toBe('off');
    const blocked = new GameMusic(() => {
      throw new Error('blocked');
    });
    expect(() => blocked.setEnabled(true, null)).not.toThrow();
    expect(blocked.enabled).toBe(true);
  });
});
