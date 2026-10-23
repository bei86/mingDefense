import { mkdirSync, writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { expect, test } from 'vitest';
import { clone, config } from '../src/game/content';
import { validSave } from '../src/game/persistence';
import { orders, simulate } from '../src/game/testing/campaign-simulation';
import {
  replayFormation,
  summarizeFormationReplays,
  type FormationReplayRow,
  type FormationVariant,
} from '../src/game/testing/formation-replay';

const variants: FormationVariant[] = ['baseline', 'reserves', 'fox', 'combined'];
const labels = {
  baseline: '原阵',
  reserves: '同种高阶替换',
  fox: '狐覆盖',
  combined: '替换与狐覆盖',
};

test.skipIf(process.env.AUDIT_FORMATION_REPLAY !== '1')(
  '8/14/20关同检查点独立布阵回放，不改变数值与黄金检查点',
  async () => {
    const seedCount = Number(process.env.FORMATION_REPLAY_SEED_COUNT ?? 64);
    if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 128)
      throw Error('FORMATION_REPLAY_SEED_COUNT须为1–128整数');
    const beforeConfig = clone(config);
    const rows: FormationReplayRow[] = [];
    const reached: Record<number, number> = { 8: 0, 14: 0, 20: 0 };
    for (let i = 0; i < seedCount; i++) {
      const seed = 20261014 + i;
      for (const policy of Object.keys(orders)) {
        for (const boost of [false, true]) {
          const campaign = simulate(seed, policy, boost, 20, false, {
            audit: true,
            allDeaths: true,
          });
          for (const stage of [8, 14, 20]) {
            const save = campaign.checkpoints[stage - 1];
            if (!save) continue;
            reached[stage]++;
            const before = clone(save);
            for (const variant of variants) {
              const replay = replayFormation(save, policy, boost, variant);
              expect(validSave(replay.opening)).toBe(true);
              expect(replay.battle.result === 'victory' || replay.battle.result === 'defeat').toBe(
                true,
              );
              expect(replay.battle.time).toBeLessThanOrEqual(180000);
              if (variant === 'baseline')
                expect(replay.battle).toEqual(campaign.results[stage - 1]);
              expect({ ...replay.opening.preparation, units: before.preparation.units }).toEqual(
                before.preparation,
              );
              expect(replay.opening.preparation.units.map(({ position: _p, ...u }) => u)).toEqual(
                before.preparation.units.map(({ position: _p, ...u }) => u),
              );
              expect(replay.battle.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(
                replay.battle.damageDone,
              );
              expect(replay.battle.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(
                replay.battle.damageTaken,
              );
              rows.push({
                ...replay,
                seed,
                policy,
                boost,
                variant,
                group: i < 12 ? 'historical' : 'validation',
              });
            }
            expect(save).toEqual(before);
          }
        }
      }
      if ((i + 1) % 8 === 0 || i + 1 === seedCount)
        console.log(`${i + 1}/${seedCount} seeds, ${rows.length} replays`);
      await setImmediate();
    }
    expect(config).toEqual(beforeConfig);
    expect(rows).toHaveLength(Object.values(reached).reduce((n, count) => n + count, 0) * 4);
    if (seedCount === 64) expect(reached).toEqual({ 8: 326, 14: 207, 20: 69 });
    const summaries = summarizeFormationReplays(rows);
    const aggregate = [8, 14, 20].flatMap((stage) =>
      variants.map((variant) => {
        const battles = rows.filter((r) => r.battle.stage === stage && r.variant === variant);
        const pairs = summaries.filter((s) => s.stage === stage && s.variant === variant);
        return {
          stage,
          variant,
          reached: battles.length,
          wins: battles.filter((r) => r.battle.result === 'victory').length,
          changed: battles.filter((r) => r.actions.length).length,
          rescued: pairs.reduce((n, s) => n + s.rescued, 0),
          lost: pairs.reduce((n, s) => n + s.lost, 0),
          bothWon: pairs.reduce((n, s) => n + s.bothWon, 0),
          bothLost: pairs.reduce((n, s) => n + s.bothLost, 0),
        };
      }),
    );
    const meta = {
      contentVersion: config.contentVersion,
      startSeed: 20261014,
      seedCount,
      reached,
      checkpoints: Object.values(reached).reduce((n, count) => n + count, 0),
      battles: rows.length,
      note: '前12种历史，其余为上一轮已使用的验证种子；不是本轮独立留出组。单关实验不推断50关路线。',
    };
    const output = 'artifacts/formation-replay';
    mkdirSync(output, { recursive: true });
    writeFileSync(
      `${output}/samples-${seedCount}.json`,
      JSON.stringify({ meta, aggregate, summaries, rows }),
    );
    const lines = [
      '# 同检查点布阵实验',
      '',
      `${config.contentVersion}；${seedCount}种子，${meta.checkpoints}个到达检查点，${meta.battles}场独立回放。`,
      '',
      meta.note,
      '',
      '天赋沿用原领取策略优先级，未强制相同选择序列；所有变体独立恢复同一存档，不试战选择阵型。',
      '',
      '| 关卡 | 实验 | 获胜/到达 | 有动作 | 败转胜 | 胜转败 | 同胜 | 同败 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...aggregate.map(
        (r) =>
          `| ${r.stage} | ${labels[r.variant]} | ${r.wins}/${r.reached} | ${r.changed} | ${r.rescued} | ${r.lost} | ${r.bothWon} | ${r.bothLost} |`,
      ),
      '',
      '原阵不与自身配对，配对列为0；无动作仍计入各变体完整分母。',
      '',
      '| 种子组 | 关卡 | 标签 | 聚灵 | 实验 | 配对数 | 有动作 | 败转胜 | 胜转败 | 同胜 | 同败 | 同胜平均用时差ms | 同胜平均剩余生命比例差 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...summaries.map(
        (s) =>
          `| ${s.group} | ${s.stage} | ${s.policy} | ${s.boost ? '开' : '关'} | ${labels[s.variant]} | ${s.pairs} | ${s.changed} | ${s.rescued} | ${s.lost} | ${s.bothWon} | ${s.bothLost} | ${s.bothWon ? (s.sameWinTimeDelta / s.bothWon).toFixed(1) : '无'} | ${s.bothWon ? (s.sameWinHpDelta / s.bothWon).toFixed(4) : '无'} |`,
      ),
      '',
      'JSON包含全部原阵检查点、每项动作、完整开战阵容、50ms步长倒下记录、输出阵亡数/首次输出倒下时间、有效护盾吸收、逐兽战报与终局敌人。护盾提供不等于有效吸收；静态覆盖不预测存活。',
      '',
    ];
    writeFileSync(`${output}/summary-${seedCount}.md`, lines.join('\n'));
    console.log(JSON.stringify({ meta, aggregate }));
  },
  900000,
);
