import { describe, expect, it } from 'vitest';
import { clone, config, heroes } from '../content';
import { Session } from '../session';
import { captureFormation, validFormation } from '../formation-presets';
import { validSave } from '../persistence';
import { createCombat } from '../combat';
import { attackDamage } from '../combat-skills';
import { simulate } from './campaign-simulation';
import {
  replaceReserves,
  foxCoverage,
  improveFoxCoverage,
  replayFormation,
  summarizeFormationReplays,
  type FormationReplayRow,
} from './formation-replay';

function fullBoard(): Session {
  const s = new Session();
  s.preparation.unlocked = Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`);
  return s;
}

function expectOnlyPositions(before: Session, after: Session): void {
  expect({ ...after.preparation, units: before.preparation.units }).toEqual(before.preparation);
  expect(after.preparation.units.map(({ position: _p, ...u }) => u)).toEqual(
    before.preparation.units.map(({ position: _p, ...u }) => u),
  );
  expect(validFormation(captureFormation(after.preparation.units))).toBe(true);
}

describe('同检查点合法布阵', () => {
  it('同种高阶替换，备战满仍保留完整多格与所有资源，重复执行不倒换', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 5, kind: 'sword_eagle', rank: 1, position: { x: 0, y: 0 } },
      { id: 6, kind: 'sword_eagle', rank: 3, position: null },
      { id: 7, kind: 'boar', rank: 2, position: null },
    ];
    const before = Session.restore(s.exportSave());
    expect(replaceReserves(s)).toHaveLength(1);
    expect(s.preparation.units.map((u) => u.position)).toEqual([null, { x: 0, y: 0 }, null]);
    expectOnlyPositions(before, s);
    expect(replaceReserves(s)).toEqual([]);
    expect(s.undo()).toBeNull();
    expect(s.preparation).toEqual(before.preparation);
  });

  it('不跨种或同阶换入，不用备战低阶替换高阶；战斗中不操作', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 5, kind: 'ember_mouse', rank: 3, position: { x: 0, y: 0 } },
      { id: 6, kind: 'ember_mouse', rank: 3, position: null },
      { id: 7, kind: 'sword_eagle', rank: 6, position: null },
    ];
    const before = clone(s.exportSave());
    expect(replaceReserves(s)).toEqual([]);
    expect(s.exportSave()).toEqual(before);
    s.preparation.units[1].rank = 1;
    expect(replaceReserves(s)).toEqual([]);
    expect(s.start()).toBeNull();
    const combat = clone(s);
    expect(replaceReserves(s)).toEqual([]);
    expect(improveFoxCoverage(s)).toEqual([]);
    expect(s).toEqual(combat);
  });

  it('狐移动只能合法严格改善完整覆盖，多格仍合法且同分不反复移动', () => {
    const s = fullBoard();
    s.preparation.units = [
      { id: 5, kind: 'shield_fox', rank: 3, position: { x: 0, y: 5 } },
      { id: 6, kind: 'sword_eagle', rank: 3, position: { x: 3, y: 0 } },
      { id: 7, kind: 'boar', rank: 3, position: { x: 3, y: 2 } },
      { id: 8, kind: 'fortune_peach', rank: 1, position: { x: 0, y: 0 } },
    ];
    const before = Session.restore(s.exportSave());
    const score = foxCoverage(s.preparation);
    expect(improveFoxCoverage(s)).toHaveLength(1);
    expect(foxCoverage(s.preparation).auraTargets).toBeGreaterThan(score.auraTargets);
    expectOnlyPositions(before, s);
    expect(improveFoxCoverage(s)).toEqual([]);
    expect(s.preparation.units[0].position).not.toEqual({ x: 0, y: 5 });
  });

  it('多狐光环不叠加，门槛以下无攻击覆盖，施盾射程包含天赋；无狐无动作', () => {
    const s = fullBoard();
    s.preparation.units = [
      {
        id: 5,
        kind: 'shield_fox',
        rank: heroes.shield_fox.skills.auraFromRank!,
        position: { x: 0, y: 0 },
      },
      {
        id: 6,
        kind: 'shield_fox',
        rank: heroes.shield_fox.skills.auraFromRank!,
        position: { x: 0, y: 1 },
      },
      { id: 7, kind: 'ember_mouse', rank: 3, position: { x: 1, y: 0 } },
    ];
    expect(foxCoverage(s.preparation).auraTargets).toBe(1);
    const combat = createCombat(s.preparation.units, {
      stageId: 1,
      progression: s.preparation.progression,
      rng: s.preparation.combatRng,
    });
    const withoutFox = { ...combat, allies: combat.allies.filter((u) => u.kind !== 'shield_fox') };
    const actualAuraRecipients = withoutFox.allies.filter(
      (u) => attackDamage(combat, u) > attackDamage(withoutFox, u),
    );
    expect(foxCoverage(s.preparation).auraTargets).toBe(actualAuraRecipients.length);
    s.preparation.units[0].rank = s.preparation.units[1].rank = 1;
    expect(foxCoverage(s.preparation).auraTargets).toBe(0);
    s.preparation.units = s.preparation.units
      .slice(0, 1)
      .concat([{ id: 7, kind: 'ember_mouse', rank: 3, position: { x: 3, y: 0 } }]);
    const plain = foxCoverage(s.preparation).shieldableFront;
    s.preparation.progression.buffs.range = 5;
    expect(foxCoverage(s.preparation).shieldableFront).toBeGreaterThan(plain);
    s.preparation.units = s.preparation.units.slice(1);
    expect(improveFoxCoverage(s)).toEqual([]);
  });

  it('未解锁不能落狐，无合法严格改善时存档完全不变', () => {
    const s = new Session();
    s.preparation.unlocked = ['0,0', '1,0'];
    s.preparation.units = [
      { id: 5, kind: 'shield_fox', rank: 3, position: { x: 0, y: 0 } },
      { id: 6, kind: 'ember_mouse', rank: 3, position: { x: 1, y: 0 } },
    ];
    const before = clone(s.exportSave());
    expect(improveFoxCoverage(s)).toEqual([]);
    expect(s.exportSave()).toEqual(before);
  });
});

describe('独立恢复单关和配对', () => {
  it('全倒下观测不改变战果、存档或随机流，全部倒下者只记录一次', () => {
    const plain = simulate(20261014, 'assault', false, 15, false, { audit: true });
    const observed = simulate(20261014, 'assault', false, 15, false, {
      audit: true,
      allDeaths: true,
    });
    expect({
      ...observed,
      results: observed.results.map((b) => {
        const { deaths: _deaths, ...audit } = b.audit!;
        return { ...b, audit };
      }),
    }).toEqual(plain);
    for (const b of observed.results) {
      const deaths = b.audit!.deaths!;
      expect(deaths).toHaveLength(b.injured);
      expect(new Set(deaths.map((u) => u.id)).size).toBe(deaths.length);
      if (deaths.length) expect(deaths[0]).toEqual(b.audit!.firstDeath);
      expect(
        deaths.every((u, i) => u.time <= b.time && (i === 0 || u.time >= deaths[i - 1].time)),
      ).toBe(true);
    }
  });

  it('原阵第8/20关逐字段复现完整经济路线，四实验不改输入存档与配置', () => {
    const source = simulate(20261014, 'control', false, 20, false, {
      audit: true,
      allDeaths: true,
    });
    const beforeConfig = clone(config);
    for (const stage of [8, 20]) {
      const save = source.checkpoints[stage - 1];
      const before = clone(save);
      expect(replayFormation(save, 'control', false, 'baseline').battle).toEqual(
        source.results[stage - 1],
      );
      for (const variant of ['reserves', 'fox', 'combined'] as const) {
        const a = replayFormation(save, 'control', false, variant);
        expect(replayFormation(save, 'control', false, variant)).toEqual(a);
        expect(validSave(a.opening)).toBe(true);
        expect(a.battle.audit!.deaths).toBeDefined();
        expect(a.outputDeaths).toBeGreaterThanOrEqual(0);
      }
      expect(save).toEqual(before);
    }
    expect(config).toEqual(beforeConfig);
    const victorySave = Session.restore(source.checkpoints[0]);
    expect(victorySave.start()).toBeNull();
    expect(() => replayFormation(victorySave.exportSave(), 'invalid', false, 'baseline')).toThrow();
  });

  it('配对统计只按胜负计改善，无动作计入且重复/缺失对照拒绝', () => {
    const source = simulate(20261014, 'assault', false, 1);
    const baseline = replayFormation(source.checkpoints[0], 'assault', false, 'baseline');
    const rows: FormationReplayRow[] = [];
    for (let i = 0; i < 4; i++) {
      for (const variant of ['baseline', 'reserves'] as const) {
        const victory = variant === 'baseline' ? i < 2 : i === 0 || i === 2;
        rows.push({
          ...clone(baseline),
          seed: i,
          policy: 'assault',
          boost: false,
          group: 'historical',
          variant,
          battle: { ...clone(baseline.battle), result: victory ? 'victory' : 'defeat' },
        });
      }
    }
    const [summary] = summarizeFormationReplays(rows);
    expect(summary).toMatchObject({
      pairs: 4,
      rescued: 1,
      lost: 1,
      bothWon: 1,
      bothLost: 1,
      changed: 0,
    });
    expect(summarizeFormationReplays([])).toEqual([]);
    expect(() => summarizeFormationReplays([...rows, rows[0]])).toThrow(/重复/);
    expect(() => summarizeFormationReplays(rows.slice(1))).toThrow(/配对/);
  });
});
