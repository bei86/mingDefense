import { describe, expect, it } from 'vitest';
import { clone, config, type Stage } from '../content';
import { waveSpawns } from '../combat';
import { Session } from '../session';
import { simulate } from './campaign-simulation';
import { runPreparedBattle } from './campaign-battle';
import {
  withRangedPressure,
  summarizePressureReplays,
  type PressureReplay,
  type RangedPressureVariant,
} from './ranged-pressure';

describe('局部远程构成候选作用域', () => {
  it.each<RangedPressureVariant>(['baseline', 'stage8', 'stage14', 'both'])(
    '%s只更改指定关卡构成，总数、出怪时间与入口序列不变，返回后恢复引用',
    (variant) => {
      const before = clone(config);
      const references = config.stages.flatMap((s) => s.waves.map((w) => w.enemies));
      const spawns = [waveSpawns(8), waveSpawns(14)];
      const expected = clone(config);
      for (const stage of expected.stages) {
        if (
          (stage.id === 8 && ['stage8', 'both'].includes(variant)) ||
          (stage.id === 14 && ['stage14', 'both'].includes(variant))
        ) {
          for (const wave of stage.waves) {
            const enemies = wave.enemies as Stage['waves'][number]['enemies'];
            enemies.ranged!--;
            enemies.wolf = (enemies.wolf ?? 0) + 1;
          }
        }
      }
      expect(
        withRangedPressure(variant, () => {
          expect(config).toEqual(expected);
          for (const [index, stage] of [8, 14].entries()) {
            expect(waveSpawns(stage).map(({ kind: _kind, ...spawn }) => spawn)).toEqual(
              spawns[index].map(({ kind: _kind, ...spawn }) => spawn),
            );
          }
          return 42;
        }),
      ).toBe(42);
      expect(config).toEqual(before);
      config.stages
        .flatMap((s) => s.waves.map((w) => w.enemies))
        .forEach((enemies, i) => expect(enemies).toBe(references[i]));
    },
  );

  it('回调抛错也恢复原配置和引用', () => {
    const before = clone(config);
    const reference = config.stages[7].waves[0].enemies;
    expect(() =>
      withRangedPressure('both', () => {
        throw Error('测试中断');
      }),
    ).toThrow('测试中断');
    expect(config).toEqual(before);
    expect(config.stages[7].waves[0].enemies).toBe(reference);
  });

  it('没有远程的波不新增狼或负数', () => {
    const wave = config.stages[7].waves[0];
    const original = wave.enemies;
    wave.enemies = { wolf: 2 };
    const reference = wave.enemies;
    try {
      withRangedPressure('stage8', () => {
        expect(wave.enemies).toBe(reference);
        expect(wave.enemies).toEqual({ wolf: 2 });
      });
      expect(wave.enemies).toBe(reference);
    } finally {
      wave.enemies = original;
    }
  });

  it.each([8, 14] as const)('真实第%i关同档回放确定，输入不变且逐目标守恒', (stage) => {
    const campaign = simulate(20261014, 'control', false, 14, false, { audit: true });
    const save = campaign.checkpoints[stage - 1];
    const before = clone(save);
    const beforeConfig = clone(config);
    const baseline = runPreparedBattle(Session.restore(save), 'control', false, false, {
      audit: true,
      enemyDamage: true,
    });
    const { enemyDamage: _damage, ...unobserved } = baseline;
    expect(unobserved).toEqual(campaign.results[stage - 1]);
    const replay = () =>
      withRangedPressure(stage === 8 ? 'stage8' : 'stage14', () =>
        runPreparedBattle(Session.restore(save), 'control', false, false, {
          audit: true,
          enemyDamage: true,
        }),
      );
    const first = replay();
    expect(replay()).toEqual(first);
    for (const battle of [baseline, first]) {
      expect(['victory', 'defeat']).toContain(battle.result);
      expect(battle.enemyDamage!.completeFromStart).toBe(true);
      expect(battle.enemyDamage!.rows.every((r) => r.kind !== 'unknown')).toBe(true);
      for (const unit of battle.report!.units) {
        const rows = battle.enemyDamage!.rows.filter((r) => r.targetId === unit.id);
        expect(rows.reduce((n, r) => n + r.hpLoss, 0)).toBe(unit.damageTaken);
        expect(rows.reduce((n, r) => n + r.shieldAbsorbed, 0)).toBe(unit.shieldAbsorbed);
      }
      expect(battle.enemyDamage!.rows.reduce((n, r) => n + r.lethal, 0)).toBe(battle.injured);
    }
    expect(save).toEqual(before);
    expect(config).toEqual(beforeConfig);
  });
});

function row(
  seed: number,
  variant: PressureReplay['variant'],
  result: string,
  time = 100,
  hpRatio = 0.5,
): PressureReplay {
  return {
    seed,
    variant,
    group: 'historical',
    stage: 8,
    policy: 'control',
    boost: false,
    battle: { result, time, hpRatio },
  };
}

describe('同档局部配对口径', () => {
  it('完整分母含四种胜负；均值仅累计同胜，按组/关分开', () => {
    const rows = [
      row(1, 'baseline', 'defeat'),
      row(1, 'stage8', 'victory'),
      row(2, 'baseline', 'victory'),
      row(2, 'stage8', 'defeat'),
      row(3, 'baseline', 'victory', 100, 0.4),
      row(3, 'stage8', 'victory', 80, 0.6),
      row(4, 'baseline', 'defeat'),
      row(4, 'stage8', 'defeat'),
    ];
    const summary = summarizePressureReplays(rows)[0];
    expect(summary).toMatchObject({
      group: 'historical',
      stage: 8,
      pairs: 4,
      rescued: 1,
      lost: 1,
      bothWon: 1,
      bothLost: 1,
      sameWinTimeDelta: -20,
    });
    expect(summary.sameWinHpDelta).toBeCloseTo(0.2);
    const holdout = rows.slice(0, 2).map((r) => ({
      ...r,
      group: 'holdout' as const,
      stage: 14 as const,
      variant: r.variant === 'baseline' ? ('baseline' as const) : ('stage14' as const),
    }));
    expect(summarizePressureReplays([...rows, ...holdout])).toHaveLength(2);
    expect(summarizePressureReplays(holdout)[0]).toMatchObject({
      pairs: 1,
      bothWon: 0,
      sameWinTimeDelta: 0,
      sameWinHpDelta: 0,
    });
    expect(summarizePressureReplays([])).toEqual([]);
  });

  it('缺失、重复或关卡候选不匹配均拒绝，不静默丢配对', () => {
    const baseline = row(1, 'baseline', 'victory');
    const variant = row(1, 'stage8', 'victory');
    expect(() => summarizePressureReplays([baseline])).toThrow('配对');
    expect(() => summarizePressureReplays([variant])).toThrow('配对');
    expect(() => summarizePressureReplays([baseline, baseline, variant])).toThrow('重复');
    expect(() => summarizePressureReplays([baseline, { ...variant, seed: 2 }])).toThrow('配对');
    expect(() => summarizePressureReplays([baseline, { ...variant, variant: 'stage14' }])).toThrow(
      '关卡',
    );
  });
});
