import { describe, expect, it } from 'vitest';
import { createCombat, stepCombat } from '../game/combat';
import { spawnEnemy } from '../game/combat-skills';
import { bossDefinition, clone, config } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { bossWarnings } from './boss-warnings';

function setup() {
  const battle = createCombat(
    [{ id: 10, kind: 'fortune_peach', rank: 6, position: { x: 1, y: 3 } }],
    { stageId: 50 },
  );
  battle.spawns = [];
  battle.allies[0].cooldown = Infinity;
  const boss = spawnEnemy(battle, 'boss', { x: 3, y: -2 });
  boss.nextCleave = 0;
  return { battle, boss };
}

describe('首领持续横扫预警投影', () => {
  it('无战斗或未生成预警时不预测下次技能', () => {
    expect(bossWarnings(null)).toEqual([]);
    const { battle } = setup();
    expect(bossWarnings(battle)).toEqual([]);
  });

  it('只保留存活首领来源，过滤普通怪、已倒下及已退场来源', () => {
    const { battle, boss } = setup();
    const wolf = spawnEnemy(battle, 'wolf', { x: 1, y: 0 });
    const dead = spawnEnemy(battle, 'boss', { x: 2, y: 0 });
    dead.hp = 0;
    battle.warnings = [boss.id, wolf.id, dead.id, 999].map((source) => ({
      source,
      row: 3,
      due: 1000,
    }));
    expect(bossWarnings(battle)).toEqual([
      { source: boss.id, row: 4, echo: false, remainingMs: 1000, frozen: false },
    ]);
    battle.enemies = battle.enemies.filter((enemy) => enemy.id !== boss.id);
    expect(bossWarnings(battle)).toEqual([]);
  });

  it('按到期、来源、行及首段排序，同一行的首段与追击都保留且读取只读', () => {
    const { battle, boss } = setup();
    const other = spawnEnemy(battle, 'boss', { x: 2, y: 0 });
    battle.time = 1000;
    battle.warnings = [
      { source: boss.id, row: 3, due: 3000 },
      { source: other.id, row: 0, due: 2000 },
      { source: boss.id, row: 3, due: 2000, echo: true },
      { source: boss.id, row: 3, due: 2000 },
      { source: boss.id, row: 0, due: 2000 },
    ];
    const before = clone(battle);
    expect(
      bossWarnings(battle).map(({ source, row, echo, remainingMs }) => [
        source,
        row,
        echo,
        remainingMs,
      ]),
    ).toEqual([
      [boss.id, 1, false, 1000],
      [boss.id, 4, false, 1000],
      [boss.id, 4, true, 1000],
      [other.id, 1, false, 1000],
      [boss.id, 4, false, 2000],
    ]);
    expect(battle).toEqual(before);
  });

  it('时间不小于零，冻结精确到期后解除，即使预警已到期也能标记冻结', () => {
    const { battle, boss } = setup();
    battle.time = 1000;
    battle.warnings = [{ source: boss.id, row: 3, due: 900 }];
    boss.frozenUntil = 1001;
    expect(bossWarnings(battle)[0]).toMatchObject({ remainingMs: 0, frozen: true });
    boss.frozenUntil = 1000;
    expect(bossWarnings(battle)[0]).toMatchObject({ remainingMs: 0, frozen: false });
  });

  it('实际引擎生成双段，冻结时剩余值保持；解冻后首段与追击依次释放消失', () => {
    const { battle, boss } = setup();
    stepCombat(battle);
    const initial = bossWarnings(battle);
    const skill = bossDefinition(50);
    expect(initial.map((warning) => warning.echo)).toEqual([false, true]);
    expect(initial[0].remainingMs).toBe(skill.cleaveWarningMs - config.runtime.tickMs);
    expect(initial[1].remainingMs - initial[0].remainingMs).toBe(skill.cleaveEchoDelayMs);
    boss.frozenUntil = battle.time + 500;
    stepCombat(battle);
    expect(bossWarnings(battle)).toEqual(initial.map((warning) => ({ ...warning, frozen: true })));
    while (battle.time < boss.frozenUntil) stepCombat(battle);
    expect(bossWarnings(battle)[0]).toMatchObject({
      frozen: false,
      remainingMs: initial[0].remainingMs,
    });
    for (let i = 0; i < 100 && bossWarnings(battle).length === 2; i++) stepCombat(battle);
    expect(bossWarnings(battle).map((warning) => warning.echo)).toEqual([true]);
    for (let i = 0; i < 100 && battle.warnings.length; i++) stepCombat(battle);
    expect(bossWarnings(battle)).toEqual([]);
    expect(battle.result).toBeNull();
  });

  it('真实Session暂停和待选天赋时保持，投影不推进时钟或RNG', () => {
    const session = rosterPlaytest();
    session.preparation.stageId = 50;
    session.start();
    session.tick();
    const battle = session.battle!;
    const boss = battle.enemies.find((enemy) => enemy.kind === 'boss')!;
    boss.nextCleave = 0;
    session.tick();
    expect(bossWarnings(battle)).toHaveLength(2);
    for (const mode of ['pause', 'choice']) {
      session.pause(mode === 'pause');
      if (mode === 'choice') battle.choices = ['health'];
      const before = JSON.stringify(session);
      const view = bossWarnings(battle);
      session.tick();
      expect(bossWarnings(battle)).toEqual(view);
      expect(JSON.stringify(session)).toBe(before);
    }
  });
});
