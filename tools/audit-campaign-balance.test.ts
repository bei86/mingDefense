import { test, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { config } from '../src/game/content';
import { validSave } from '../src/game/persistence';
import { simulate, orders, type SimulationOptions } from '../src/game/testing/campaign-simulation';
import {
  compareCampaignRuns,
  summarizeCampaignRuns,
  type AuditRun,
} from '../src/game/testing/campaign-audit';

const experiments: { id: string; label: string; options: SimulationOptions }[] = [
  { id: 'baseline', label: '原策略', options: {} },
  { id: 'peach', label: '仅桃后排', options: { protectPeach: true } },
  { id: 'survival', label: '仅生存天赋', options: { survivalBuffs: true } },
  {
    id: 'combined',
    label: '桃后排与生存天赋',
    options: { protectPeach: true, survivalBuffs: true },
  },
];
const policyNames: Record<string, string> = {
  assault: '强攻标签',
  control: '控制标签',
  economy: '经济标签',
};
const labels = Object.fromEntries(experiments.map((e) => [e.id, e.label]));

test.skipIf(process.env.AUDIT_CAMPAIGN_BALANCE !== '1')(
  '现行三格50关配对策略诊断，不改配置或检查点',
  async () => {
    const seedCount = Number(process.env.AUDIT_SEED_COUNT ?? 64);
    if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 128)
      throw Error('AUDIT_SEED_COUNT须为1–128整数');
    const configBefore = JSON.stringify(config);
    const runs: AuditRun[] = [];
    const output = 'artifacts/campaign-balance-audit';
    mkdirSync(output, { recursive: true });
    for (const experiment of experiments) {
      for (let i = 0; i < seedCount; i++) {
        const seed = 20261014 + i;
        for (const policy of Object.keys(orders))
          for (const boost of [false, true]) {
            const run = simulate(seed, policy, boost, 50, false, {
              ...experiment.options,
              audit: true,
            });
            expect(run.checkpoints.every(validSave)).toBe(true);
            expect(run.results.every((b) => ['victory', 'defeat'].includes(b.result))).toBe(true);
            expect(run.results.every((b) => b.audit && b.time <= 180000)).toBe(true);
            for (const b of run.results) {
              expect(b.report!.units.reduce((n, u) => n + u.damageDone, 0)).toBe(b.damageDone);
              expect(b.report!.units.reduce((n, u) => n + u.damageTaken, 0)).toBe(b.damageTaken);
            }
            // Keep full roster and per-unit report at the terminal battle; intermediate totals stay compact.
            const results = run.results.map((b, j) =>
              j === run.results.length - 1
                ? b
                : { ...b, report: undefined, audit: { ...b.audit!, roster: [] } },
            );
            runs.push({
              seed,
              policy,
              boost,
              variant: experiment.id,
              group: i < 12 ? 'historical' : 'holdout',
              complete: run.complete,
              results,
            });
          }
        if ((i + 1) % 8 === 0 || i + 1 === seedCount)
          console.log(`${experiment.id}: ${i + 1}/${seedCount} seeds, ${runs.length} routes`);
        // Let the worker deliver progress and acknowledge RPC during the long CPU-bound matrix.
        await setImmediate();
      }
    }
    expect(JSON.stringify(config)).toBe(configBefore);
    expect(runs).toHaveLength(seedCount * 3 * 2 * 4);
    if (seedCount >= 12) {
      const baseline = runs.filter((r) => r.variant === 'baseline' && r.group === 'historical');
      expect(
        ['assault', 'control', 'economy'].map(
          (p) => baseline.filter((r) => r.policy === p && r.complete).length,
        ),
      ).toEqual([0, 1, 1]);
    }
    const summaries = summarizeCampaignRuns(runs);
    const comparisons = compareCampaignRuns(runs);
    const meta = {
      contentVersion: config.contentVersion,
      spawnRow: config.waves.spawnRow,
      startSeed: 20261014,
      seedCount,
      targetStage: 50,
      routes: runs.length,
      historicalSeeds: Math.min(seedCount, 12),
      holdoutSeeds: Math.max(seedCount - 12, 0),
      experiments,
    };
    writeFileSync(
      `${output}/samples-${seedCount}.json`,
      JSON.stringify({ meta, summaries, comparisons, runs }),
    );
    const lines = [
      '# 三类固定策略50关诊断',
      '',
      `版本 ${config.contentVersion}，${seedCount}种子、${runs.length}条路线，三格接敌。前12种子是历史对照，其余是新增验证组。`,
      '',
      '领取优先级标签不是三种纯构筑。以下比例仅表示固定脚本样本，不是玩家胜率或最优策略证明。所有实验保持同一配置；只使用合法Session命令。',
      '',
      '| 种子组 | 实验 | 领取策略 | 聚灵 | 路线数 | 完成50关 | 平均完成关数 | 主要首次失败关 | 全灭/时限/其他 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...summaries.map(
        (s) =>
          `| ${s.group === 'historical' ? '历史' : '新增'} | ${labels[s.variant]} | ${policyNames[s.policy]} | ${s.boost ? '开' : '关'} | ${s.runs} | ${s.complete} | ${s.meanCompleted.toFixed(2)} | ${
            Object.entries(s.failedAt)
              .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
              .slice(0, 3)
              .map(([stage, n]) => `${stage}关:${n}`)
              .join('、') || '无'
          } | ${s.failureReasons.wiped}/${s.failureReasons.timeout}/${s.failureReasons.other} |`,
      ),
      '',
      '## 相同种子与聚灵状态配对',
      '',
      '改善和退步只比较完成关数，不因同关更快或剩余生命更多就声称改善。',
      '',
      '| 种子组 | 实验 | 领取策略 | 聚灵 | 配对数 | 改善 | 退步 | 不变 | 平均完成关数差 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...comparisons.map(
        (s) =>
          `| ${s.group === 'historical' ? '历史' : '新增'} | ${labels[s.variant]} | ${policyNames[s.policy]} | ${s.boost ? '开' : '关'} | ${s.pairs} | ${s.improved} | ${s.regressed} | ${s.unchanged} | ${(s.deltaCompleted / s.pairs).toFixed(2)} |`,
      ),
      '',
      '## 每关到达与胜利',
      '',
      '下表胜利/到达，分母不含更早失败的路线；两个聚灵状态合并。',
      '',
      '| 实验 | 领取策略 | 5关 | 10关 | 15关 | 20关 | 25关 | 30关 | 35关 | 40关 | 45关 | 50关 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...experiments.flatMap((e) =>
        Object.keys(orders).map((policy) => {
          const rows = runs.filter((r) => r.variant === e.id && r.policy === policy);
          return `| ${e.label} | ${policyNames[policy]} | ${[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((stage) => `${rows.filter((r) => r.results[stage - 1]?.result === 'victory').length}/${rows.filter((r) => r.results[stage - 1]).length}`).join(' | ')} |`;
        }),
      ),
      '',
      '完整逐关统计、失败首个倒下者（50ms步长内同刻按ID）、终局存活敌人、开战阵容及逐兽战报见同名samples JSON。未采集实际玩家操作或手机性能。',
      '',
    ];
    writeFileSync(`${output}/summary-${seedCount}.md`, lines.join('\n'));
    console.log(
      JSON.stringify({
        routes: runs.length,
        summary: `${output}/summary-${seedCount}.md`,
        complete: experiments.map((e) => ({
          variant: e.id,
          policies: Object.keys(orders).map((policy) => ({
            policy,
            complete: runs.filter((r) => r.variant === e.id && r.policy === policy && r.complete)
              .length,
          })),
        })),
      }),
    );
  },
  900000,
);
