import { describe, expect, it } from 'vitest';
import { center, clone, heroIds, heroes, type HeroId } from '../game/content';
import { createCombat, stepCombat } from '../game/combat';
import { attackDamage, releaseAttack, spawnEnemy } from '../game/combat-skills';
import { Session } from '../game/session';
import { preparationStats } from './preparation-stats';

function setup(kind: HeroId = 'ember_mouse', rank = 1) {
  const s = new Session();
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  s.preparation.units = [{ id: 10, kind, rank, position: { x: 0, y: 0 } }];
  s.preparation.nextId = 11;
  return s;
}

function current(s: Session, label: string, id = 10) {
  return preparationStats(s.preparation, id)!.rows.find((row) => row.label === label)!.current;
}

describe('整备当前站位属性', () => {
  it.each(heroIds)('%s各阶最大生命和真实开战一致，攻击值与战斗读取一致', (kind) => {
    for (let rank = 1; rank <= 6; rank++) {
      const s = setup(kind, rank);
      s.preparation.progression.buffs = { health: 2, attack: 3, boar_attack: 2, bear_attack: 2 };
      const model = preparationStats(s.preparation, 10)!;
      expect(s.start()).toBeNull();
      const ally = s.battle!.allies[0];
      expect(model.rows[0]).toEqual({
        label: '最大生命',
        base: String(heroes[kind].hp[rank - 1]),
        current: String(ally.maxHp),
      });
      if (kind !== 'fortune_peach' && kind !== 'shield_fox')
        expect(model.rows[1].current).toBe(
          String(Number(attackDamage(s.battle!, ally).toFixed(2))),
        );
    }
  });

  it('普通攻击、专属天赋与狐光环相加，单次命中投影与真实释放包一致', () => {
    const s = setup('boar');
    s.preparation.progression.buffs = { attack: 2, boar_attack: 1 };
    s.preparation.units.push({ id: 11, kind: 'shield_fox', rank: 3, position: { x: 2, y: 0 } });
    expect(current(s, '基础命中值')).toBe('213');
    expect(s.start()).toBeNull();
    const battle = s.battle!;
    const enemy = spawnEnemy(battle, 'wolf', { x: 1.5, y: -0.5 });
    const packets: Parameters<typeof releaseAttack>[2] = [];
    releaseAttack(
      battle,
      { team: 'ally', source: 10, target: enemy.id, ordinal: 1, due: 0 },
      packets,
    );
    expect(packets).toEqual([{ team: 'enemy', id: enemy.id, damage: 213, source: 10 }]);
  });

  it('光环使用多格整体中心，含精确边界，移出后失效；射程天赋不扩光环', () => {
    const s = setup('scatter_bear');
    s.preparation.progression.buffs.range = 3;
    s.preparation.units.push({ id: 11, kind: 'shield_fox', rank: 3, position: { x: 2, y: 2 } });
    expect(preparationStats(s.preparation, 10)!.auraSources.map((u) => u.id)).toEqual([11]);
    expect(current(s, '基础命中值')).toBe('88');
    s.preparation.units[1].position = { x: 3, y: 2 };
    expect(preparationStats(s.preparation, 10)!.auraSources).toEqual([]);
    expect(current(s, '基础命中值')).toBe('80');
    expect(current(s, '寻敌射程')).toBe('4.6 格');
  });

  it('多只上阵狐只加一次，低阶、备战和未领取狐不生效', () => {
    const s = setup();
    s.preparation.units.push(
      { id: 11, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } },
      { id: 12, kind: 'shield_fox', rank: 6, position: { x: 0, y: 1 } },
      { id: 13, kind: 'shield_fox', rank: 2, position: { x: 1, y: 1 } },
      { id: 14, kind: 'shield_fox', rank: 6, position: null },
    );
    s.preparation.offers = [{ id: 1, kind: 'shield_fox', rank: 6, claimed: false }];
    expect(preparationStats(s.preparation, 10)!.auraSources.map((u) => u.id)).toEqual([11, 12]);
    expect(current(s, '基础命中值')).toBe('66');
    s.preparation.units[1].position = null;
    s.preparation.units[2].position = null;
    expect(current(s, '基础命中值')).toBe('60');
  });

  it.each(heroIds.filter((kind) => kind !== 'fortune_peach'))(
    '%s常态及聚灵间隔与真实模拟首次冷却一致，按步长上取整',
    (kind) => {
      const s = setup(kind);
      s.preparation.progression.buffs.attack_speed = 3;
      for (const held of [false, true]) {
        const battle = createCombat(s.preparation.units, {
          progression: s.preparation.progression,
        });
        battle.spawns = [];
        battle.energy = 100;
        const p = center(kind, battle.allies[0].position);
        spawnEnemy(battle, 'wolf', { x: p.x, y: p.y - 0.5 });
        stepCombat(battle, held);
        expect(battle.allies[0].ordinal).toBe(1);
        const label = held ? '聚灵动作间隔' : '常态动作间隔';
        expect(current(s, label)).toBe(`${battle.allies[0].cooldown / 1000} 秒`);
      }
    },
  );

  it('聚灵遵守现有攻速上限；鼠残血和斩杀天赋不算入基础命中', () => {
    const s = setup();
    s.preparation.progression.buffs = { attack_speed: 20, mouse_finisher: 1, mouse_execute: 1 };
    expect(current(s, '常态动作间隔')).toBe('0.35 秒');
    expect(current(s, '聚灵动作间隔')).toBe('0.35 秒');
    expect(current(s, '基础命中值')).toBe('60');
  });

  it('狐按目标生命比例施盾，带盾天赋及射程；不把攻击加成作为盾量', () => {
    const s = setup('shield_fox', 3);
    s.preparation.progression.buffs = { fox_shield: 2, attack: 10, range: 3, health: 1 };
    expect(current(s, '单次施盾比例')).toBe('3.48%');
    expect(current(s, '施盾射程')).toBe('3.1 格');
    expect(preparationStats(s.preparation, 10)!.auraSources).toEqual([]);
    expect(s.start()).toBeNull();
    const battle = s.battle!;
    releaseAttack(battle, { team: 'ally', source: 10, target: 10, ordinal: 1, due: 0 }, []);
    expect(battle.allies[0].shield).toBe(Math.floor(battle.allies[0].maxHp * 0.0348));
  });

  it('桃产钱间隔固定，攻速、攻击、射程和光环不提高产钱', () => {
    const s = setup('fortune_peach', 5);
    s.preparation.progression.buffs = { attack: 10, attack_speed: 10, range: 3 };
    s.preparation.units.push({ id: 11, kind: 'shield_fox', rank: 6, position: { x: 1, y: 0 } });
    const model = preparationStats(s.preparation, 10)!;
    expect(model.rows).toEqual([
      { label: '最大生命', base: '1200', current: '1200' },
      { label: '每次产钱', base: '1 灵钱', current: '1 灵钱' },
      { label: '产钱间隔', base: '6 秒', current: '6 秒' },
    ]);
    expect(model.auraSources).toEqual([]);
    expect(s.start()).toBeNull();
    s.battle!.time = 6000;
    s.battle!.energy = 100;
    stepCombat(s.battle!, true);
    expect(s.battle!.income).toBe(1);
    expect(s.battle!.allies[0].incomeAt).toBe(12000);
  });

  it('未知ID及备战无站位属性，返回数据不共享源坐标', () => {
    const s = setup();
    expect(preparationStats(s.preparation, 999)).toBeNull();
    const model = preparationStats(s.preparation, 10)!;
    model.position.x = 5;
    expect(s.preparation.units[0].position!.x).toBe(0);
    s.preparation.units[0].position = null;
    expect(preparationStats(s.preparation, 10)).toBeNull();
  });

  it('读取不改变状态、RNG及撤销；真实移动/撤销实时更新光环', () => {
    const s = setup();
    s.preparation.units.push({ id: 11, kind: 'shield_fox', rank: 3, position: { x: 1, y: 0 } });
    const before = clone(s.preparation);
    expect(current(s, '基础命中值')).toBe('66');
    expect(s.preparation).toEqual(before);
    expect(s.revision).toBe(0);
    expect(s.canUndo).toBe(false);
    expect(s.transfer({ type: 'unit', id: 10 }, { x: 5, y: 5 })).toBeNull();
    const moved = clone(s.preparation);
    const revision = s.revision;
    expect(current(s, '基础命中值')).toBe('60');
    expect(s.preparation).toEqual(moved);
    expect(s.revision).toBe(revision);
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before);
    expect(current(s, '基础命中值')).toBe('66');
  });
});
