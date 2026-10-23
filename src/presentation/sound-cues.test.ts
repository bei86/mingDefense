import { describe, expect, it } from 'vitest';
import { clone, type HeroId } from '../game/content';
import { Session } from '../game/session';
import { releaseAttack, spawnEnemy } from '../game/combat-skills';
import { CombatFeedback } from './combat-feedback';
import { combatSound, combatSoundCues, type CombatSoundCue } from './sound-cues';
import { soundPalette } from './sound-palette';

const skills: [HeroId, CombatSoundCue][] = [
  ['ember_mouse', 'mouse_attack'],
  ['boar', 'boar_attack'],
  ['sword_eagle', 'eagle_attack'],
  ['ice_fish', 'fish_attack'],
  ['shield_fox', 'fox_shield'],
  ['piercing_monkey', 'monkey_attack'],
  ['scatter_bear', 'bear_attack'],
];

describe('真实释放记录的灵兽音色', () => {
  it.each(skills)('%s释放识别为%s，去重、离屏及新基线不补播且只读', (kind, cue) => {
    const session = new Session();
    session.preparation.units = [{ id: 5, kind, rank: 1, position: { x: 1, y: 3 } }];
    expect(session.start()).toBeNull();
    const battle = session.battle!;
    const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 2.8 });
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    const attack = {
      team: 'ally' as const,
      source: 5,
      target: kind === 'shield_fox' ? 5 : enemy.id,
      due: 0,
      ordinal: 1,
    };
    releaseAttack(battle, attack, []);
    expect(battle.flashes.length).toBeGreaterThan(0);
    const before = clone(session);
    expect(feedback.update(session, 25)).toEqual([cue]);
    expect(feedback.update(session, 25)).toEqual([]);
    expect(session).toEqual(before);
    expect(new CombatFeedback().update(session, 0)).toEqual([]);
    releaseAttack(battle, { ...attack, ordinal: 2 }, []);
    expect(feedback.update(session, 25, false)).toEqual([]);
    expect(feedback.update(session, 25)).toEqual([]);
    session.backToPreparation();
    expect(feedback.update(session, 0)).toEqual([]);
  });

  it('敌方即使带灵兽kind也只用原低音，旧记录缺kind安全回退', () => {
    for (const [kind] of skills)
      expect(
        combatSound({ team: 'enemy', kind, at: 0, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }),
      ).toBe('attack');
    expect(combatSound({ team: 'ally', at: 0, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } })).toBe(
      'attack',
    );
  });

  it('每种音色独立、短促有界，战斗音色峰值合计不超过原攻击', () => {
    const fingerprints = new Set<string>();
    for (const cue of combatSoundCues) {
      const notes = soundPalette[cue];
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.length).toBeLessThanOrEqual(2);
      expect(notes.reduce((sum, note) => sum + (note.gain ?? 0.055), 0)).toBeLessThanOrEqual(0.025);
      for (const note of notes) {
        expect(note.frequency).toBeGreaterThan(20);
        expect(note.end ?? note.frequency).toBeGreaterThan(20);
        expect((note.delay ?? 0) + note.duration).toBeLessThanOrEqual(0.18);
        expect(note.duration).toBeGreaterThan(0.008);
      }
      fingerprints.add(JSON.stringify(notes));
    }
    expect(fingerprints.size).toBe(combatSoundCues.length);
  });
});
