import { describe, expect, it } from 'vitest';
import { createCombat, enemyTarget, stepCombat } from './combat';
import { spawnEnemy } from './combat-skills';
import type { EnemyKind, HeroId } from './content';
import type { Unit } from './model';

function unit(id: number, kind: HeroId, x: number, y: number, rank = 1): Unit {
  return { id, kind, rank, position: { x, y } };
}

describe('逐排推进与类型仇恨', () => {
  it('前排未清空时，后排更近且仇恨更高也不能被选中', () => {
    const allies = createCombat([
      unit(1, 'sword_eagle', 1, 1, 6),
      unit(2, 'fortune_peach', 4, 3),
    ]).allies;
    expect(enemyTarget(allies, { x: 4.5, y: 3.5 })!.id).toBe(1);
    allies[0].hp = 0;
    expect(enemyTarget(allies, { x: 4.5, y: 3.5 })!.id).toBe(2);
    allies[1].hp = 0;
    expect(enemyTarget(allies, { x: 4.5, y: 3.5 })).toBeUndefined();
  });
  it('同排同阶按用户指定桃、狐、鼠、豚、鲤、隼的顺序选敌，忽略阵亡单位', () => {
    const kinds: HeroId[] = [
      'fortune_peach',
      'shield_fox',
      'ember_mouse',
      'boar',
      'ice_fish',
      'sword_eagle',
    ];
    const allies = kinds.map((kind, i) => createCombat([unit(i + 1, kind, i, 2)]).allies[0]);
    for (const ally of allies) {
      expect(enemyTarget([...allies].reverse(), { x: 5.5, y: -0.5 })!.id).toBe(ally.id);
      ally.hp = 0;
    }
  });
  it('同排低阶优先于类型仇恨与距离，同阶后再比较类型', () => {
    const allies = createCombat([
      unit(1, 'fortune_peach', 1, 2, 6),
      unit(2, 'shield_fox', 2, 2, 3),
      unit(3, 'boar', 3, 2, 2),
      unit(4, 'sword_eagle', 5, 2),
    ]).allies;
    for (const id of [4, 3, 2, 1]) {
      expect(enemyTarget([...allies].reverse(), { x: 1.5, y: 2.5 })!.id).toBe(id);
      allies.find((u) => u.id === id)!.hp = 0;
    }
  });
  it('多格灵兽按最上方占格归排，阵亡前不能推进到它身后的单位', () => {
    for (const kind of ['sword_eagle', 'ice_fish'] as const) {
      const allies = createCombat([unit(1, kind, 1, 1), unit(2, 'fortune_peach', 4, 2)]).allies;
      expect(enemyTarget(allies, { x: 4.5, y: 2.5 })!.id).toBe(1);
    }
  });
  it('同排同仇恨按距离、实例ID稳定选敌，不受输入数组顺序影响', () => {
    const allies = createCombat([
      unit(9, 'ember_mouse', 1, 2),
      unit(2, 'ember_mouse', 3, 2),
    ]).allies;
    expect(enemyTarget(allies, { x: 1.5, y: 1.5 })!.id).toBe(9);
    expect(enemyTarget(allies, { x: 2.5, y: 1.5 })!.id).toBe(2);
    expect(enemyTarget([...allies].reverse(), { x: 2.5, y: 1.5 })!.id).toBe(2);
  });
  it.each<EnemyKind>(['wolf', 'runner', 'croc', 'summoned_wolf', 'boss'])(
    '%s实际攻击先清整排，再伤下一排',
    (kind) => {
      const s = createCombat(
        [unit(1, 'ember_mouse', 1, 1), unit(2, 'boar', 3, 1), unit(3, 'fortune_peach', 1, 3)],
        { stageId: 5 },
      );
      s.spawns = [{ at: 100000, x: 0 }];
      for (const ally of s.allies) ally.cooldown = 100000;
      s.allies[0].hp = 10;
      s.allies[1].hp = 10;
      spawnEnemy(s, kind, { x: 1.5, y: 0.5 });
      const rear = s.allies[2];
      for (let tick = 0; tick < 2000 && s.allies.slice(0, 2).some((u) => u.hp > 0); tick++) {
        stepCombat(s);
        expect(rear.hp).toBe(rear.maxHp);
      }
      expect(s.allies.slice(0, 2).every((u) => u.hp === 0)).toBe(true);
      for (let tick = 0; tick < 2000 && rear.hp === rear.maxHp; tick++) stepCombat(s);
      expect(rear.hp).toBeLessThan(rear.maxHp);
    },
  );
});
