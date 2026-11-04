import type { Combat } from '../game/combat-model';
import { appearances } from '../game/content';
import type { InspectedAlly } from './battle-inspection';
import { reportContribution } from './report-contribution';
import { reportMetrics, reportValue } from './report-unit-sort';

function contributionValue(value: number | null): string {
  return value === null || value < 0 ? '未记录' : String(Math.floor(value));
}

/** Export the same per-participant records as inspection, including fallen allies. */
export function snapshotContributionLines(
  battle: Combat,
  units: readonly InspectedAlly[],
): string[] {
  const lines = [
    '',
    '## 本关累计贡献',
    '',
    '| 灵兽与编号 | 状态 | 伤害 | 承伤 | 提供护盾 | 护盾吸收 | 产钱 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const unit of units) {
    const entry = unit.stats ? { id: unit.id, ...unit.stats } : null;
    const values = reportMetrics.map(({ key }) =>
      contributionValue(entry ? reportValue(entry, key) : null),
    );
    lines.push(
      `| ${appearances[unit.kind].name} #${unit.id} · ${unit.rank}阶 | ${unit.alive ? '存活' : '已倒下'} | ${values.join(' | ')} |`,
    );
  }
  if (!units.length) lines.push('', '无上阵灵兽贡献。');
  lines.push('', '全体上阵合计（含倒下灵兽，不含备战）：', '');
  for (const { key, label } of reportMetrics) {
    const model = reportContribution(battle, key);
    let total = '未记录（无逐兽记录）';
    if (model) {
      total =
        model.total === null
          ? `未记录（缺${model.missing}只记录）`
          : contributionValue(model.total);
    }
    lines.push(`- ${label}合计：${total}`);
  }
  lines.push(
    '',
    '逐只显示值向下取整，合计按原始记录求和后向下取整，可能与逐行显示值之和不同。缺失记录不补0或用战斗总数替代。承伤不含护盾吸收，提供护盾不等于实际吸收；产钱仅计逐兽记录，不代表本关总收入。这是暂停时的本关累计，继续守卫后会变化，不是终局战报。',
  );
  return lines;
}
