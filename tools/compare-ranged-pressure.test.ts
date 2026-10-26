import { mkdirSync, writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { expect, test } from 'vitest';
import { clone, config } from '../src/game/content';
import { validSave } from '../src/game/persistence';
import { Session, type SessionSave } from '../src/game/session';
import { runPreparedBattle, type BattleSample } from '../src/game/testing/campaign-battle';
import { orders, simulate } from '../src/game/testing/campaign-simulation';
import {
  compareCampaignRuns,
  summarizeCampaignRuns,
  type AuditRun,
} from '../src/game/testing/campaign-audit';
import {
  withRangedPressure,
  summarizePressureReplays,
  type PressureReplay,
  type RangedPressureVariant,
} from '../src/game/testing/ranged-pressure';

const variants: RangedPressureVariant[] = ['baseline', 'stage8', 'stage14', 'both'];
const labels = { baseline: '原方案', stage8: '仅第8关', stage14: '仅第14关', both: '两关都替换' };
type Route = AuditRun & { terminalOpening: SessionSave };
type LocalReplay = PressureReplay & { opening: SessionSave; battle: BattleSample };

function validateBattle(b: BattleSample): void {
  expect(['victory', 'defeat']).toContain(b.result);
  expect(b.time).toBeLessThanOrEqual(180000);
  expect(b.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(b.damageDone);
  expect(b.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(b.damageTaken);
  if (!b.enemyDamage) return;
  expect(b.enemyDamage.completeFromStart).toBe(true);
  const sources = b.enemyDamage.rows;
  expect(sources.every((r) => r.kind !== 'unknown' && r.attack !== 'unknown')).toBe(true);
  expect(sources.reduce((n, r) => n + r.hpLoss, 0)).toBe(b.damageTaken);
  expect(sources.reduce((n, r) => n + r.lethal, 0)).toBe(b.injured);
  for (const unit of b.report!.units) {
    const target = sources.filter((r) => r.targetId === unit.id);
    expect(target.reduce((n, r) => n + r.hpLoss, 0)).toBe(unit.damageTaken);
    expect(target.reduce((n, r) => n + r.shieldAbsorbed, 0)).toBe(unit.shieldAbsorbed);
    expect(target.reduce((n, r) => n + r.lethal, 0)).toBeLessThanOrEqual(1);
  }
}

test.skipIf(process.env.COMPARE_RANGED_PRESSURE !== '1')(
  '预先固定的8/14关构成候选，同开战档与历史/新种子50关配对',
  async () => {
    const newSeedCount = Number(process.env.RANGED_PRESSURE_NEW_SEEDS ?? 32);
    if (!Number.isInteger(newSeedCount) || newSeedCount < 1 || newSeedCount > 64)
      throw Error('RANGED_PRESSURE_NEW_SEEDS须为1–64整数');
    const beforeConfig = clone(config);
    const seedGroups = [
      { group: 'historical' as const, start: 20261014, count: 12 },
      { group: 'holdout' as const, start: 20270101, count: newSeedCount },
    ];
    const runs: Route[] = [];
    const local: LocalReplay[] = [];
    for (const { group, start, count } of seedGroups) {
      for (let i = 0; i < count; i++) {
        const seed = start + i;
        for (const policy of Object.keys(orders)) {
          for (const boost of [false, true]) {
            const baseline = simulate(seed, policy, boost, 50, false, { audit: true });
            for (const stage of [8, 14] as const) {
              const opening = baseline.checkpoints[stage - 1];
              if (!opening) continue;
              expect(validSave(opening)).toBe(true);
              const before = clone(opening);
              const candidate = stage === 8 ? 'stage8' : 'stage14';
              for (const variant of ['baseline', candidate] as const) {
                const battle = withRangedPressure(variant, () =>
                  runPreparedBattle(Session.restore(opening), policy, boost, false, {
                    audit: true,
                    enemyDamage: true,
                  }),
                );
                validateBattle(battle);
                if (variant === 'baseline') {
                  const { enemyDamage: _damage, ...result } = battle;
                  expect(result).toEqual(baseline.results[stage - 1]);
                }
                local.push({ seed, policy, boost, group, stage, variant, opening, battle });
              }
              expect(opening).toEqual(before);
            }
            for (const variant of variants) {
              const run =
                variant === 'baseline'
                  ? baseline
                  : withRangedPressure(variant, () =>
                      simulate(seed, policy, boost, 50, false, { audit: true }),
                    );
              expect(run.checkpoints.every(validSave)).toBe(true);
              expect(run.checkpoints).toHaveLength(run.results.length);
              run.results.forEach(validateBattle);
              // Full campaigns may diverge after the first changed stage, never before it.
              const unchangedPrefix = variant === 'stage14' ? 13 : 7;
              expect(run.results.slice(0, unchangedPrefix)).toEqual(
                baseline.results.slice(0, unchangedPrefix),
              );
              expect(run.checkpoints.slice(0, unchangedPrefix)).toEqual(
                baseline.checkpoints.slice(0, unchangedPrefix),
              );
              const results = run.results.map((b, index) =>
                index === run.results.length - 1 || [8, 14, 20].includes(b.stage)
                  ? b
                  : { ...b, report: undefined, audit: { ...b.audit!, roster: [] } },
              );
              runs.push({
                seed,
                policy,
                boost,
                group,
                variant,
                complete: run.complete,
                results,
                terminalOpening: run.checkpoints.at(-1)!,
              });
              expect(config).toEqual(beforeConfig);
            }
          }
        }
        if ((i + 1) % 4 === 0 || i + 1 === count)
          console.log(
            `${group} ${i + 1}/${count} seeds, ${runs.length} routes, ${local.length / 2} local pairs`,
          );
        await setImmediate();
      }
    }
    expect(runs).toHaveLength((12 + newSeedCount) * 3 * 2 * variants.length);
    expect(config).toEqual(beforeConfig);
    expect(
      runs.filter((r) => r.group === 'historical' && r.variant === 'baseline' && r.complete),
    ).toHaveLength(2);
    const summaries = summarizeCampaignRuns(runs);
    const comparisons = compareCampaignRuns(runs);
    const localPairs = summarizePressureReplays(local);
    const aggregate = seedGroups.flatMap(({ group }) =>
      variants.map((variant) => {
        const rows = runs.filter((r) => r.group === group && r.variant === variant);
        const pairs = comparisons.filter((r) => r.group === group && r.variant === variant);
        return {
          group,
          variant,
          routes: rows.length,
          complete: rows.filter((r) => r.complete).length,
          meanCompleted:
            rows.reduce((n, r) => n + r.results.filter((b) => b.result === 'victory').length, 0) /
            rows.length,
          improved: pairs.reduce((n, p) => n + p.improved, 0),
          regressed: pairs.reduce((n, p) => n + p.regressed, 0),
          unchanged: pairs.reduce((n, p) => n + p.unchanged, 0),
          deltaCompleted: pairs.reduce((n, p) => n + p.deltaCompleted, 0),
        };
      }),
    );
    const stageTotals = seedGroups.flatMap(({ group }) =>
      variants.flatMap((variant) =>
        [8, 14, 20, 25, 50].map((stage) => {
          const battles = runs
            .filter((r) => r.group === group && r.variant === variant)
            .flatMap((r) => r.results.filter((b) => b.stage === stage));
          return {
            group,
            variant,
            stage,
            reached: battles.length,
            won: battles.filter((b) => b.result === 'victory').length,
          };
        }),
      ),
    );
    const sourceTotals = seedGroups.flatMap(({ group }) =>
      ([8, 14] as const).flatMap((stage) =>
        (['baseline', stage === 8 ? 'stage8' : 'stage14'] as const).map((variant) => {
          const rows = local.filter(
            (r) => r.group === group && r.stage === stage && r.variant === variant,
          );
          const sources = rows.flatMap((r) => r.battle.enemyDamage!.rows);
          return {
            group,
            stage,
            variant,
            battles: rows.length,
            hpLoss: sources.reduce((n, r) => n + r.hpLoss, 0),
            rangedHpLoss: sources
              .filter((r) => r.kind === 'ranged')
              .reduce((n, r) => n + r.hpLoss, 0),
            shieldAbsorbed: sources.reduce((n, r) => n + r.shieldAbsorbed, 0),
          };
        }),
      ),
    );
    const meta = {
      contentVersion: config.contentVersion,
      seedGroups,
      variants,
      change:
        '指定关卡每波翎羽客-1、奔雷狼+1；总怪数/出怪时间/入口序列不变；属性/种类轮转/经验改变，每关基础击杀经验少9。',
      routes: runs.length,
      localPairs: local.length / 2,
      note: '候选在新组运行前固定；新组仅为项目可见记录首次使用，非玩家分布或统计显著性证明。正式配置保留。',
    };
    const output = 'artifacts/ranged-pressure';
    mkdirSync(output, { recursive: true });
    writeFileSync(
      `${output}/samples-${newSeedCount}.json`,
      JSON.stringify({
        meta,
        aggregate,
        stageTotals,
        summaries,
        comparisons,
        localPairs,
        sourceTotals,
        runs,
        local,
      }),
    );
    const groupLabel = (group: string) => (group === 'historical' ? '历史12' : `新${newSeedCount}`);
    const lines = [
      '# 第8/14关远程构成候选',
      '',
      `${config.contentVersion}；${runs.length}条完整路线、${local.length / 2}份同档配对。`,
      '',
      meta.change,
      '',
      meta.note,
      '',
      '| 组 | 候选 | 路线 | 完成50关 | 平均完成关数 | 改善 | 退步 | 不变 | 平均完成关数差 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...aggregate.map(
        (r) =>
          `| ${groupLabel(r.group)} | ${labels[r.variant]} | ${r.routes} | ${r.complete} | ${r.meanCompleted.toFixed(3)} | ${r.improved} | ${r.regressed} | ${r.unchanged} | ${r.variant === 'baseline' ? '无配对' : (r.deltaCompleted / r.routes).toFixed(3)} |`,
      ),
      '',
      '基线不与自身配对。完整路线从第一关开始，后关阵容/资源/随机流可能分化；不等于同开局战斗。',
      '',
      '| 组 | 关卡 | 同原档配对 | 败转胜 | 胜转败 | 同胜 | 同败 | 同胜平均用时差ms | 同胜平均生命比例差 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...localPairs.map(
        (r) =>
          `| ${groupLabel(r.group)} | ${r.stage} | ${r.pairs} | ${r.rescued} | ${r.lost} | ${r.bothWon} | ${r.bothLost} | ${r.bothWon ? (r.sameWinTimeDelta / r.bothWon).toFixed(1) : '无'} | ${r.bothWon ? (r.sameWinHpDelta / r.bothWon).toFixed(4) : '无'} |`,
      ),
      '',
      '同档只用baseline实际到达的开战档；第8关只比较stage8，第14关只比较stage14。both在该原档会重复局部候选，因此不重复计。未到达不填失败。',
      '',
      '| 组 | 候选 | 关卡 | 到达 | 获胜 |',
      '| --- | --- | --- | --- | --- |',
      ...stageTotals.map(
        (r) =>
          `| ${groupLabel(r.group)} | ${labels[r.variant]} | ${r.stage} | ${r.reached} | ${r.won} |`,
      ),
      '',
      '| 组 | 局部关卡 | 候选 | 场次 | 总扣血 | 远程扣血 | 实际吸盾 |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...sourceTotals.map(
        (r) =>
          `| ${groupLabel(r.group)} | ${r.stage} | ${labels[r.variant]} | ${r.battles} | ${r.hpLoss} | ${r.rangedHpLoss} | ${r.shieldAbsorbed} |`,
      ),
      '',
      '局部累计承伤受战斗时长和胜败影响；更低不是独立因果证明。JSON保留逐策略/聚灵配对、逐关指标、终关完整开战档与报告、局部完整开战档与伤害来源。',
      '',
      '三种领取标签不是成熟纯构筑，相关种子路线不是独立玩家。未改正式数值、存档版本、黄金检查点或出怪算法。',
      '',
    ];
    writeFileSync(`${output}/summary-${newSeedCount}.md`, lines.join('\n'));
    console.log(JSON.stringify({ meta, aggregate, localPairs }));
  },
  900000,
);
