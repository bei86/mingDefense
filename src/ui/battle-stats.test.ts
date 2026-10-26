import { describe, expect, it } from 'vitest';
import { center, clone, heroIds, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { releaseAttack, spawnEnemy } from '../game/combat-skills';
import { battleStats } from './battle-stats';

function setup(kind: HeroId = 'ember_mouse', rank = 1) {
  return createCombat([
    { id: 10, kind, rank, position: { x: 0, y: 0 } },
    { id: 11, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } },
  ]);
}

function value(b: ReturnType<typeof setup>, label: string) {
  return battleStats(b, 10)!.rows.find((row) => row.label === label)!.value;
}

describe('暂停战斗当前属性', () => {
  it('读取战中天赋和存活光环，真实命中包一致；狐倒下立即失效，不叠加', () => {
    const b = setup();
    b.allies.push({ ...b.allies[1], id: 12, position: { x: 0, y: 1 } });
    expect(value(b, '基础命中值')).toBe('66');
    expect(battleStats(b, 10)!.auraSources.map((u) => u.id)).toEqual([11, 12]);
    b.allies[1].hp = 0;
    b.allies[2].hp = 0;
    expect(value(b, '基础命中值')).toBe('60');
    expect(battleStats(b, 10)!.auraSources).toEqual([]);
    b.progression.buffs.attack = 2;
    const enemy = spawnEnemy(b, 'wolf', { x: 0.5, y: 0.5 });
    const packets: Parameters<typeof releaseAttack>[2] = [];
    releaseAttack(b, { team: 'ally', source: 10, target: enemy.id, ordinal: 1, due: 0 }, packets);
    expect(packets[0].damage).toBe(Number(value(b, '基础命中值')));
    expect(packets[0].damage).toBeGreaterThan(60);
  });

  it('光环按整体中心含精确边界，低阶/边界外失效，射程天赋不扩光环', () => {
    const b = setup('scatter_bear');
    b.progression.buffs.range = 3;
    b.allies[1].position = { x: 2, y: 2 };
    expect(value(b, '基础命中值')).toBe('88');
    expect(battleStats(b, 10)!.auraSources).toHaveLength(1);
    b.allies[1].rank = 2;
    expect(value(b, '基础命中值')).toBe('80');
    b.allies[1].rank = 3;
    b.allies[1].position.x = 3;
    expect(battleStats(b, 10)!.auraSources).toEqual([]);
    expect(value(b, '寻敌射程')).toBe('4.6 格');
  });

  it.each(heroIds.filter((kind) => kind !== 'fortune_peach'))(
    '%s两种动作间隔等于真实战斗冷却',
    (kind) => {
      for (const held of [false, true]) {
        const b = setup(kind);
        b.progression.buffs.attack_speed = 3;
        b.energy = 100;
        b.spawns = [];
        const p = center(kind, b.allies[0].position);
        spawnEnemy(b, 'wolf', { x: p.x, y: p.y - 0.5 });
        const projected = value(b, held ? '聚灵动作间隔' : '常态动作间隔');
        stepCombat(b, held);
        expect(b.allies[0].ordinal).toBe(1);
        expect(projected).toBe(`${b.allies[0].cooldown / 1000} 秒`);
      }
    },
  );

  it('不把boosted残留当作当前承诺，攻速封顶、专属攻击与技能额外伤害有边界', () => {
    const b = setup('boar');
    b.progression.buffs = { attack: 2, boar_attack: 1, attack_speed: 20 };
    expect(value(b, '基础命中值')).toBe('213');
    expect(value(b, '常态动作间隔')).toBe(value(b, '聚灵动作间隔'));
    const before = battleStats(b, 10);
    b.boosted = true;
    b.energy = 0;
    expect(battleStats(b, 10)).toEqual(before);
    const mouse = setup();
    mouse.allies[1].hp = 0;
    mouse.progression.buffs = { mouse_finisher: 1, mouse_execute: 1 };
    expect(value(mouse, '基础命中值')).toBe('60');
  });

  it('狐施盾含专属天赋，和真实盾量一致，不误用攻击加成', () => {
    const b = setup('shield_fox', 3);
    b.progression.buffs = { fox_shield: 2, attack: 10, range: 3 };
    expect(value(b, '单次施盾比例')).toBe('3.48%');
    expect(value(b, '施盾射程')).toBe('3.1 格');
    expect(battleStats(b, 10)!.auraSources).toEqual([]);
    releaseAttack(b, { team: 'ally', source: 10, target: 10, ordinal: 1, due: 0 }, []);
    expect(b.allies[0].shield).toBe(Math.floor(b.allies[0].maxHp * 0.0348));
  });

  it('桃只列固定产钱，真实产钱一致；倒下者不再列行动值', () => {
    const b = setup('fortune_peach', 5);
    b.progression.buffs = { attack_speed: 20, range: 3, attack: 10 };
    expect(battleStats(b, 10)!.rows).toEqual([
      { label: '每次产钱', value: '1 灵钱' },
      { label: '产钱间隔', value: '6 秒' },
    ]);
    b.time = 6000;
    b.energy = 100;
    stepCombat(b, true);
    expect(b.income).toBe(1);
    expect(b.allies[0].incomeAt).toBe(12000);
    b.allies[0].hp = 0;
    expect(battleStats(b, 10)).toMatchObject({ alive: false, rows: [], auraSources: [] });
  });

  it('空战斗/缺ID安全，读取不改变任何战斗或RNG，坐标不共享', () => {
    expect(battleStats(null, 10)).toBeNull();
    const b = setup();
    expect(battleStats(b, 999)).toBeNull();
    const before = clone(b);
    const model = battleStats(b, 10)!;
    model.position.x = 99;
    model.auraSources[0].position.y = 99;
    expect(b).toEqual(before);
    b.allies[0].hp = 0;
    expect(battleStats(b, 10)!.rows).toEqual([]);
    b.allies = [];
    expect(battleStats(b, 10)).toBeNull();
  });
});
