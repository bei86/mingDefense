import { expect, test } from 'vitest';
import { clone } from '../game/content';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import { bossWarnings } from './boss-warnings';
import { pauseForBossWarning } from './warning-inspection';

function setup() {
  const session = rosterPlaytest();
  session.preparation.stageId = 50;
  session.start();
  session.tick();
  const battle = session.battle!;
  const boss = battle.enemies.find((enemy) => enemy.kind === 'boss')!;
  boss.nextCleave = 0;
  session.tick();
  const [first, echo] = bossWarnings(battle);
  expect(first.echo).toBe(false);
  expect(echo.echo).toBe(true);
  return { session, battle, boss, first, echo };
}

test.each(['first', 'echo'] as const)(
  '实际双段%s入口暂停并释放聚灵，战斗/随机/阵容不变',
  (kind) => {
    const scene = setup();
    const { session, battle } = scene;
    const target = scene[kind];
    session.held = true;
    const expected = JSON.parse(JSON.stringify(session));
    expected.paused = true;
    expected.held = false;
    const selected = pauseForBossWarning(session, battle, target);
    expect(selected).toEqual({ source: target.source, row: target.row, echo: target.echo });
    expect(selected).not.toBe(target);
    session.tick();
    expect(JSON.parse(JSON.stringify(session))).toEqual(expected);
  },
);

test('冻结推迟due后仍可定位同一道预警，返回目标不包含倒计时', () => {
  const { session, battle, boss, first } = setup();
  boss.frozenUntil = battle.time + 500;
  const due = battle.warnings[0].due;
  session.tick();
  expect(battle.warnings[0].due).toBeGreaterThan(due);
  const before = clone(battle);
  expect(pauseForBossWarning(session, battle, first)).toEqual({
    source: first.source,
    row: first.row,
    echo: false,
  });
  expect(battle).toEqual(before);
});

test.each(['released', 'dead', 'left', 'ordinary', 'row', 'echo'])(
  '%s失效点击不暂停、不释放聚灵或修改状态',
  (reason) => {
    const { session, battle, boss, first } = setup();
    if (reason === 'released') {
      for (let i = 0; i < 100 && battle.warnings.some((warning) => !warning.echo); i++)
        session.tick();
      expect(battle.warnings.some((warning) => warning.echo)).toBe(true);
    }
    if (reason === 'dead') boss.hp = 0;
    if (reason === 'left') battle.enemies = battle.enemies.filter((enemy) => enemy !== boss);
    if (reason === 'ordinary') boss.kind = 'wolf';
    if (reason === 'row') first.row = 99;
    if (reason === 'echo') {
      battle.warnings = battle.warnings.filter((warning) => !warning.echo);
      first.echo = true;
    }
    session.held = true;
    const before = JSON.stringify(session);
    expect(pauseForBossWarning(session, battle, first)).toBeNull();
    expect(JSON.stringify(session)).toBe(before);
  },
);

test.each(['prepare', 'victory', 'defeat', 'choices', 'other-battle'])(
  '%s状态不允许旧快捷入口影响当前流程',
  (mode) => {
    const { session, battle, first } = setup();
    if (mode === 'choices') battle.choices = ['attack', 'health'];
    else if (mode === 'other-battle') session.battle = clone(battle);
    else session.phase = mode as 'prepare' | 'victory' | 'defeat';
    const before = JSON.stringify(session);
    expect(pauseForBossWarning(session, battle, first)).toBeNull();
    expect(JSON.stringify(session)).toBe(before);
  },
);
