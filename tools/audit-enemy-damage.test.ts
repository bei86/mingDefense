import { mkdirSync, writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { expect, test } from 'vitest';
import { clone, config } from '../src/game/content';
import type { EnemyDamageRow } from '../src/game/enemy-damage-diagnostics';
import { validSave } from '../src/game/persistence';
import { Session } from '../src/game/session';
import { orders, simulate } from '../src/game/testing/campaign-simulation';
import { runPreparedBattle, type BattleSample } from '../src/game/testing/campaign-battle';

type Sample = {
  seed: number;
  policy: string;
  boost: boolean;
  group: string;
  opening: ReturnType<Session['exportSave']>;
  battle: BattleSample;
};
type SourceSummary = Pick<
  EnemyDamageRow,
  'kind' | 'attack' | 'hits' | 'hpLoss' | 'shieldAbsorbed' | 'lethal'
> & {
  stage: number;
};

test.skipIf(process.env.AUDIT_ENEMY_DAMAGE !== '1')(
  '8/14/20关原阵敌方伤害守恒与开关逐字段对照',
  async () => {
    const seedCount = Number(process.env.ENEMY_DAMAGE_SEED_COUNT ?? 64);
    if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 128)
      throw Error('ENEMY_DAMAGE_SEED_COUNT须为1–128整数');
    const beforeConfig = clone(config);
    const rows: Sample[] = [];
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
            const opening = campaign.checkpoints[stage - 1];
            if (!opening) continue;
            reached[stage]++;
            expect(validSave(opening)).toBe(true);
            const before = clone(opening);
            const session = Session.restore(opening);
            const battle = runPreparedBattle(session, policy, boost, false, {
              audit: true,
              allDeaths: true,
              enemyDamage: true,
            });
            const { enemyDamage, ...baseline } = battle;
            expect(baseline).toEqual(campaign.results[stage - 1]);
            expect(opening).toEqual(before);
            expect(['victory', 'defeat']).toContain(battle.result);
            expect(battle.time).toBeLessThanOrEqual(180000);
            expect(enemyDamage!.completeFromStart).toBe(true);
            const sources = enemyDamage!.rows;
            expect(sources.every((r) => r.kind !== 'unknown' && r.attack !== 'unknown')).toBe(true);
            expect(sources.reduce((n, r) => n + r.hpLoss, 0)).toBe(battle.damageTaken);
            expect(battle.report!.units.reduce((n, r) => n + r.damageTaken, 0)).toBe(
              battle.damageTaken,
            );
            expect(sources.reduce((n, r) => n + r.shieldAbsorbed, 0)).toBe(
              battle.report!.units.reduce((n, r) => n + r.shieldAbsorbed, 0),
            );
            for (const unit of battle.report!.units) {
              const target = sources.filter((r) => r.targetId === unit.id);
              expect(target.reduce((n, r) => n + r.hpLoss, 0)).toBe(unit.damageTaken);
              expect(target.reduce((n, r) => n + r.shieldAbsorbed, 0)).toBe(unit.shieldAbsorbed);
              expect(target.reduce((n, r) => n + r.lethal, 0)).toBe(
                Number(session.battle!.allies.find((a) => a.id === unit.id)!.hp <= 0),
              );
            }
            expect(sources.reduce((n, r) => n + r.lethal, 0)).toBe(battle.injured);
            rows.push({
              seed,
              policy,
              boost,
              group: i < 12 ? 'historical' : 'previously-used',
              opening,
              battle,
            });
          }
        }
      }
      if ((i + 1) % 8 === 0 || i + 1 === seedCount)
        console.log(`${i + 1}/${seedCount} seeds, ${rows.length} replays`);
      await setImmediate();
    }
    expect(config).toEqual(beforeConfig);
    expect(rows).toHaveLength(Object.values(reached).reduce((n, count) => n + count, 0));
    if (seedCount === 64) expect(reached).toEqual({ 8: 326, 14: 207, 20: 69 });

    const totals = new Map<string, SourceSummary>();
    for (const { battle } of rows) {
      for (const source of battle.enemyDamage!.rows) {
        const key = `${battle.stage}:${source.kind}:${source.attack}`;
        let total = totals.get(key);
        if (!total) {
          total = {
            stage: battle.stage,
            kind: source.kind,
            attack: source.attack,
            hits: 0,
            hpLoss: 0,
            shieldAbsorbed: 0,
            lethal: 0,
          };
          totals.set(key, total);
        }
        total.hits += source.hits;
        total.hpLoss += source.hpLoss;
        total.shieldAbsorbed += source.shieldAbsorbed;
        total.lethal += source.lethal;
      }
    }
    const summaries = [...totals.values()].sort(
      (a, b) => a.stage - b.stage || b.hpLoss - a.hpLoss || a.kind.localeCompare(b.kind),
    );
    const aggregate = [8, 14, 20].map((stage) => {
      const battles = rows.filter((r) => r.battle.stage === stage).map((r) => r.battle);
      return {
        stage,
        reached: battles.length,
        wins: battles.filter((b) => b.result === 'victory').length,
        hpLoss: battles.reduce((n, b) => n + b.damageTaken, 0),
        shieldAbsorbed: battles.reduce(
          (n, b) => n + b.report!.units.reduce((m, u) => m + u.shieldAbsorbed, 0),
          0,
        ),
        injured: battles.reduce((n, b) => n + b.injured, 0),
      };
    });
    const meta = {
      contentVersion: config.contentVersion,
      startSeed: 20261014,
      seedCount,
      reached,
      battles: rows.length,
      note: '前12为历史，其余为此前已使用的种子，不是本轮独立留出组。三标签是领取/天赋脚本，不是成熟纯流派。仅记录到达关卡，不能当作玩家胜率。',
    };
    const output = 'artifacts/enemy-damage-audit';
    mkdirSync(output, { recursive: true });
    writeFileSync(
      `${output}/samples-${seedCount}.json`,
      JSON.stringify({ meta, aggregate, summaries, rows }),
    );
    const percent = (value: number, total: number) =>
      total ? `${((100 * value) / total).toFixed(2)}%` : '无';
    const lines = [
      '# 敌方伤害来源诊断',
      '',
      `${config.contentVersion}；${seedCount}种子，${rows.length}场到达检查点原阵回放。`,
      '',
      meta.note,
      '',
      '所有回放去掉观测字段后与原路线逐字段一致；逐兽/全场扣血、吸盾与致重伤次数守恒，未知来源为0。',
      '',
      '| 关卡 | 到达 | 胜 | 实际扣血 | 护盾吸收 | 重伤 |',
      '| --- | --- | --- | --- | --- | --- |',
      ...aggregate.map(
        (r) =>
          `| ${r.stage} | ${r.reached} | ${r.wins} | ${r.hpLoss} | ${r.shieldAbsorbed} | ${r.injured} |`,
      ),
      '',
      '| 关卡 | 敌人 | 攻击 | 实际扣血 | 扣血占比 | 护盾吸收 | 吸盾占比 | 有效包 | 致重伤包 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...summaries.map((r) => {
        const total = aggregate.find((a) => a.stage === r.stage)!;
        return `| ${r.stage} | ${r.kind} | ${r.attack} | ${r.hpLoss} | ${percent(r.hpLoss, total.hpLoss)} | ${r.shieldAbsorbed} | ${percent(r.shieldAbsorbed, total.shieldAbsorbed)} | ${r.hits} | ${r.lethal} |`;
      }),
      '',
      '只计算实际扣血/实际吸盾；过量伤害及零贡献包不计。致重伤包只代表最后一击，不能单独当作败因。子怪归自己，owner只关联父怪。',
      '',
      'JSON包含开战存档、种子/标签/聚灵/种子组、完整战果与来源×目标×攻击方式聚合。firstAt/lastAt是50ms步开始的逻辑时间，倒下审计为步结束时间。中途启用不是完整整场记录。',
      '',
      '累计占比受交战时长、阵容和到达筛选影响，不能据此断言单位强弱、最优阵型或玩家胜率；未自动调整数值。',
      '',
    ];
    writeFileSync(`${output}/summary-${seedCount}.md`, lines.join('\n'));
    console.log(JSON.stringify({ meta, aggregate, summaries }));
  },
  900000,
);
