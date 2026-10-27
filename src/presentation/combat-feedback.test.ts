import { describe, expect, it } from 'vitest';
import { clone, center } from '../game/content';
import { Session } from '../game/session';
import { spawnEnemy } from '../game/combat-skills';
import { CombatFeedback } from './combat-feedback';

function prepared() {
  const session = new Session();
  session.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
  return session;
}

describe('只读战斗反馈', () => {
  it('飘字开关独立于声音与模拟，清空旧数且重新开启不补播', () => {
    const session = prepared();
    session.start();
    const battle = session.battle!;
    battle.spawns = [{ at: 100000, x: 1 }];
    const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: 2.8 });
    enemy.hp = 10000;
    const shown = new CombatFeedback();
    const hidden = new CombatFeedback();
    shown.update(session, 0);
    hidden.update(session, 0, true, false);
    let sawNumbers = false;
    for (let i = 0; i < 25 && session.phase === 'combat'; i++) {
      session.tick();
      const before = clone(session);
      expect(hidden.update(session, 50, true, false)).toEqual(shown.update(session, 50));
      expect(session).toEqual(before);
      expect(hidden.numbers.active).toEqual([]);
      sawNumbers ||= shown.numbers.active.length > 0;
    }
    expect(sawNumbers).toBe(true);
    shown.update(session, 0, true, false);
    expect(shown.numbers.active).toEqual([]);
    enemy.hp -= 10;
    shown.update(session, 0, true, false);
    enemy.hp -= 10;
    shown.update(session, 0, true, true);
    expect(shown.numbers.active).toEqual([]);
    enemy.hp -= 7;
    const before = clone(session);
    shown.update(session, 0, true, true);
    expect(shown.numbers.active).toEqual([expect.objectContaining({ team: 'enemy', amount: 7 })]);
    expect(session).toEqual(before);
  });

  it('初始化不补播，真实放置与备战席合成各触发一次，撤销不重播合成', () => {
    const session = prepared();
    const feedback = new CombatFeedback();
    expect(feedback.update(session, 0)).toEqual([]);
    session.transfer({ type: 'unit', id: 5 }, 'reserve');
    feedback.update(session, 25);
    session.transfer({ type: 'offer', id: 2 }, { merge: 5 });
    expect(feedback.update(session, 25)).toEqual(['merge']);
    expect(feedback.update(session, 25)).toEqual([]);
    session.undo();
    expect(feedback.update(session, 25)).toEqual([]);
    session.transfer({ type: 'unit', id: 5 }, { x: 1, y: 3 });
    expect(feedback.update(session, 25)).toEqual(['deploy']);
    session.reset();
    expect(feedback.update(session, 25)).toEqual([]);
  });

  it('真实攻击释放只识别一次，姿态有界，不改变Session；暂停与倍速同步', () => {
    const session = prepared();
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    session.start();
    const battle = session.battle!;
    battle.spawns = [{ at: 100000, x: 1 }];
    spawnEnemy(battle, 'wolf', { x: 1.5, y: 2.8 });
    feedback.update(session, 25);
    let attacked = false;
    for (let i = 0; i < 10 && !attacked; i++) {
      session.tick();
      attacked = feedback.update(session, 50).includes('mouse_attack');
    }
    expect(attacked).toBe(true);
    const before = clone(session);
    expect(feedback.update(session, 25)).not.toContain('mouse_attack');
    const pose = feedback.pose('ally', 5);
    expect(Math.abs(pose.dx)).toBeLessThanOrEqual(4);
    expect(Math.abs(pose.dy)).toBeLessThanOrEqual(6.3);
    expect(session).toEqual(before);
    session.pause(true);
    const paused = feedback.pose('ally', 5);
    feedback.update(session, 5000);
    expect(feedback.pose('ally', 5)).toEqual(paused);
    const time = feedback.time;
    session.pause(false);
    session.speed = 2;
    feedback.update(session, 25);
    expect(feedback.time - time).toBe(50);
    expect(feedback.pose('ally', 5, true)).toMatchObject({ dx: 0, dy: 0, rotation: 0, scale: 1 });
  });

  it('护盾自然到期不闪光，真实护盾吸收与生命承伤闪光，冻结怪物不摇摆', () => {
    const session = prepared();
    session.start();
    const battle = session.battle!;
    const ally = battle.allies[0];
    const enemy = spawnEnemy(battle, 'wolf', { x: 1, y: 1 });
    const feedback = new CombatFeedback();
    ally.shield = 100;
    feedback.update(session, 0);
    ally.shield = 0;
    expect(feedback.update(session, 25)).toEqual([]);
    expect(feedback.pose('ally', ally.id).tint).toBe(0xffffff);
    battle.report!.units[0].shieldAbsorbed += 10;
    feedback.update(session, 25);
    expect(feedback.pose('ally', ally.id).tint).not.toBe(0xffffff);
    feedback.update(session, 100);
    feedback.update(session, 100);
    ally.hp -= 1;
    enemy.y += 0.1;
    enemy.frozenUntil = battle.time + 5000;
    feedback.update(session, 25);
    expect(feedback.pose('ally', ally.id).tint).not.toBe(0xffffff);
    expect(feedback.pose('enemy', enemy.id)).toMatchObject({ dx: 0, dy: 0, rotation: 0, scale: 1 });
  });

  it('退场池有上限且过期清空；重伤灵兽淡出，回滚清除旧影像', () => {
    const session = prepared();
    session.start();
    const battle = session.battle!;
    for (let i = 0; i < 40; i++) spawnEnemy(battle, 'wolf', { x: 1, y: 1 });
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    battle.enemies = [];
    battle.allies[0].hp = 0;
    feedback.update(session, 25);
    expect(feedback.ghosts).toHaveLength(24);
    expect(feedback.pose('ally', 5).alpha).toBe(1);
    for (let i = 0; i < 3; i++) feedback.update(session, 100);
    expect(feedback.ghosts).toEqual([]);
    expect(feedback.pose('ally', 5).alpha).toBe(0.28);
    session.backToPreparation();
    expect(feedback.update(session, 0)).toEqual([]);
    expect(feedback.ghosts).toEqual([]);
    expect(feedback.pose('ally', 5).alpha).toBe(1);
  });

  it('首领登场与二阶段优先于普通预警；新一轮横扫独立提示，初次读档不提示', () => {
    const session = prepared();
    session.preparation.stageId = 35;
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    session.start();
    const battle = session.battle!;
    const boss = spawnEnemy(battle, 'boss', { x: 3.5, y: 0 });
    expect(feedback.update(session, 25)).toContain('boss');
    expect(feedback.notice?.kind).toBe('boss');
    expect(new CombatFeedback().update(session, 0)).toEqual([]);
    boss.phase2 = true;
    battle.warnings.push({ source: boss.id, row: 0, due: 2000 });
    expect(feedback.update(session, 25)).toEqual(['phase', 'warning']);
    expect(feedback.notice?.kind).toBe('phase');
    expect(feedback.update(session, 25)).toEqual([]);
    session.pause(true);
    const notice = feedback.notice;
    feedback.update(session, 5000);
    expect(feedback.notice).toEqual(notice);
    session.pause(false);
    for (let i = 0; i < 19; i++) feedback.update(session, 100);
    expect(feedback.notice).toBeNull();
    battle.warnings = [{ source: boss.id, row: 2, due: 12000 }];
    expect(feedback.update(session, 25)).toEqual(['warning']);
    expect(feedback.notice?.detail).toContain('第 3 行');
  });

  it('收入、升级与结果各播一次，离屏不补播，重试不播放旧结果', () => {
    const session = prepared();
    session.start();
    const battle = session.battle!;
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    battle.income += 5;
    battle.progression.level += 1;
    expect(feedback.update(session, 25)).toEqual(['income', 'levelup']);
    expect(feedback.update(session, 25)).toEqual([]);
    battle.income += 5;
    expect(feedback.update(session, 1000, false)).toEqual([]);
    expect(feedback.update(session, 25)).toEqual([]);
    session.phase = 'victory';
    expect(feedback.update(session, 25)).toEqual(['victory']);
    expect(feedback.update(session, 25)).toEqual([]);
    session.phase = 'combat';
    battle.time = 100;
    feedback.update(session, 25);
    battle.time = 0;
    expect(feedback.update(session, 25)).toEqual([]);
    expect(feedback.notice).toBeNull();
    expect(center('ember_mouse', battle.allies[0].position)).toEqual({ x: 1.5, y: 3.5 });
  });

  it('双段预警仅播一次且不被第二段覆盖；冻结延迟不重复播报，下一轮仍提示', () => {
    const session = prepared();
    session.preparation.stageId = 45;
    session.start();
    const battle = session.battle!;
    const feedback = new CombatFeedback();
    feedback.update(session, 0);
    const first = { source: 100, row: 0, due: 2200 };
    const echo = { source: 100, row: 0, due: 3100, echo: true };
    battle.warnings = [first, echo];
    expect(feedback.update(session, 25)).toEqual(['warning']);
    expect(feedback.notice).toMatchObject({
      label: '双段横扫将至',
      detail: '第 1 行 · 两段锁定同一行',
    });
    first.due += 50;
    echo.due += 50;
    expect(feedback.update(session, 25)).toEqual([]);
    battle.warnings = [echo];
    expect(feedback.update(session, 25)).toEqual([]);
    battle.warnings = [
      { source: 100, row: 2, due: 16000 },
      { source: 100, row: 2, due: 16900, echo: true },
    ];
    expect(feedback.update(session, 25)).toEqual(['warning']);
    expect(feedback.notice?.detail).toContain('第 3 行');
  });
});
