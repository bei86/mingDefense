import { describe, expect, it } from 'vitest';
import { clone, config } from '../content';
import { Session } from '../session';
import { captureFormation, validFormation } from '../formation-presets';
import { validSave } from '../persistence';
import type { BuffId } from '../model';
import { simulate } from './campaign-simulation';
import {
  protectPeaches,
  summarizeCampaignRuns,
  compareCampaignRuns,
  type AuditRun,
} from './campaign-audit';

describe('平衡实验观察与合法干预', () => {
  it('观察开关不改变完整结果、随机数或开战检查点', () => {
    const plain = simulate(20261014, 'assault', false, 15);
    const observed = simulate(20261014, 'assault', false, 15, false, { audit: true });
    expect({
      ...observed,
      results: observed.results.map(({ audit: _audit, ...rest }) => rest),
    }).toEqual(plain);
    expect(observed.results.every((b) => b.audit && b.audit.deployed > 0)).toBe(true);
    const failure = observed.results.at(-1)!;
    expect(failure.result).toBe('defeat');
    expect(failure.stage).toBe(15);
    expect(failure.time).toBe(104050);
    expect(failure.audit!.firstDeath!.time).toBeGreaterThan(0);
    expect(failure.audit!.firstDeath!.time).toBeLessThanOrEqual(failure.time);
    expect(failure.audit!.aliveEnemies.length).toBeGreaterThan(0);
    expect(failure.audit!.unspawned).toBe(0);
    expect(observed.checkpoints.every(validSave)).toBe(true);

    // Independently replay the saved preparation: no ally may die before the recorded step.
    const replay = Session.restore(observed.checkpoints[14]);
    expect(replay.start()).toBeNull();
    const priority: BuffId[] = [
      'attack',
      'attack_speed',
      'boar_attack',
      'bear_attack',
      'monkey_vulnerability',
      'eagle_residue',
      'health',
      'slow',
      'range',
      'reward',
    ];
    const firstDeath = failure.audit!.firstDeath!;
    while (replay.battle!.time < firstDeath.time) {
      expect(replay.battle!.allies.every((u) => u.hp > 0)).toBe(true);
      if (replay.hasChoices) {
        const choice = [...replay.battle!.choices].sort(
          (a, b) => priority.indexOf(a) - priority.indexOf(b),
        )[0];
        expect(replay.chooseBuff(choice)).toBeNull();
      } else {
        expect(replay.phase).toBe('combat');
        replay.tick();
      }
    }
    expect(replay.battle!.time).toBe(firstDeath.time);
    const dead = replay.battle!.allies.filter((u) => u.hp <= 0);
    expect(Math.min(...dead.map((u) => u.id))).toBe(firstDeath.id);
    expect(dead.find((u) => u.id === firstDeath.id)).toMatchObject({
      kind: firstDeath.kind,
      rank: firstDeath.rank,
      position: firstDeath.position,
    });
  });

  it('保护桃只通过合法后移/交换，不改资源与拥有权，多格不能被切开', () => {
    const s = new Session();
    s.preparation.unlocked = ['0,0', '0,1', '0,2', '1,2'];
    s.preparation.units = [
      { id: 5, kind: 'fortune_peach', rank: 3, position: { x: 0, y: 0 } },
      { id: 6, kind: 'boar', rank: 1, position: { x: 0, y: 2 } },
    ];
    const before = clone(s.preparation);
    expect(protectPeaches(s)).toBe(1);
    expect(s.preparation.units[0].position).toEqual({ x: 0, y: 1 });
    expect(s.preparation.units[1]).toEqual(before.units[1]);
    expect({ ...s.preparation, units: before.units }).toEqual(before);
    expect(validFormation(captureFormation(s.preparation.units))).toBe(true);
    const s2 = new Session();
    s2.preparation.unlocked = ['0,0', '0,1'];
    s2.preparation.units = [
      { id: 5, kind: 'fortune_peach', rank: 3, position: { x: 0, y: 0 } },
      { id: 6, kind: 'ember_mouse', rank: 2, position: { x: 0, y: 1 } },
    ];
    expect(protectPeaches(s2)).toBe(1);
    expect(s2.preparation.units.map((u) => u.position)).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
    const unchanged = clone(s2.exportSave());
    expect(protectPeaches(s2)).toBe(0);
    expect(s2.exportSave()).toEqual(unchanged);
  });

  it('无桃、备战桃、同排与战斗阶段不移动，不用另一个桃交换制造循环', () => {
    const s = new Session();
    s.preparation.unlocked = ['0,0', '0,1'];
    s.preparation.units = [
      { id: 5, kind: 'fortune_peach', rank: 1, position: { x: 0, y: 0 } },
      { id: 6, kind: 'fortune_peach', rank: 2, position: { x: 0, y: 1 } },
      { id: 7, kind: 'fortune_peach', rank: 3, position: null },
    ];
    const before = clone(s.exportSave());
    expect(protectPeaches(s)).toBe(0);
    expect(s.exportSave()).toEqual(before);
    expect(s.start()).toBeNull();
    const battle = clone(s);
    expect(protectPeaches(s)).toBe(0);
    expect(s).toEqual(battle);
    expect(protectPeaches(new Session())).toBe(0);
  });

  it('两种干预重跑确定且产生合法检查点，游戏配置完整不变', () => {
    const before = clone(config);
    const options = { audit: true, protectPeach: true, survivalBuffs: true };
    const a = simulate(20261014, 'economy', false, 10, false, options);
    expect(simulate(20261014, 'economy', false, 10, false, options)).toEqual(a);
    expect(a.checkpoints.every(validSave)).toBe(true);
    expect(config).toEqual(before);
  });
});

function run(
  seed: number,
  variant: string,
  completed: number,
  failed?: 'wiped' | 'timeout',
): AuditRun {
  const result = simulate(20261014, 'assault', false, 1, false, { audit: true });
  const template = result.results[0];
  const results = Array.from({ length: completed + (failed ? 1 : 0) }, (_, i) => ({
    ...clone(template),
    stage: i + 1,
    result: i < completed ? 'victory' : 'defeat',
    hp: i < completed ? template.hp : failed === 'wiped' ? 0 : 10,
    time: i < completed ? template.time : failed === 'timeout' ? 180000 : 50000,
  }));
  return {
    seed,
    policy: 'assault',
    boost: false,
    variant,
    group: 'holdout',
    complete: !failed,
    results,
  };
}

describe('配对聚合', () => {
  it('早败不计入后关到达分母，全灭与时限分开，终关独立计数', () => {
    const rows = [
      run(1, 'baseline', 1, 'wiped'),
      run(2, 'baseline', 2, 'timeout'),
      run(3, 'baseline', 3),
    ];
    const [summary] = summarizeCampaignRuns(rows, 3);
    expect(summary.runs).toBe(3);
    expect(summary.complete).toBe(1);
    expect(summary.stages.map((s) => [s.reached, s.won, s.failed])).toEqual([
      [3, 3, 0],
      [3, 2, 1],
      [2, 1, 1],
    ]);
    expect(summary.failureReasons).toEqual({ wiped: 1, timeout: 1, other: 0 });
    expect(summary.failedAt).toEqual({ '2': 1, '3': 1 });
    expect(summary.meanCompleted).toBe(2);
    expect(summary.stages[2].meanTime).toBe((180000 + rows[2].results[2].time) / 2);
    expect(summarizeCampaignRuns(rows, 4)[0].stages[3]).toMatchObject({
      reached: 0,
      won: 0,
      failed: 0,
      meanTime: null,
      meanEndHpRatio: null,
    });
  });
  it('同种子/策略/聚灵/分组配对，明确改善退步和不变，不按用时假称改善', () => {
    const rows = [
      run(1, 'baseline', 1, 'wiped'),
      run(2, 'baseline', 2, 'wiped'),
      run(3, 'baseline', 3),
      run(1, 'peach', 3),
      run(2, 'peach', 1, 'wiped'),
      run(3, 'peach', 3),
    ];
    const [comparison] = compareCampaignRuns(rows);
    expect(comparison).toMatchObject({
      variant: 'peach',
      pairs: 3,
      improved: 1,
      regressed: 1,
      unchanged: 1,
    });
    expect(() => compareCampaignRuns([...rows, rows[0]])).toThrow(/重复/);
    expect(() => compareCampaignRuns(rows.slice(1))).toThrow(/配对/);
    const missingVariant = rows.filter((r) => !(r.seed === 1 && r.variant === 'peach'));
    expect(() => compareCampaignRuns(missingVariant)).toThrow(/配对/);
  });
});
