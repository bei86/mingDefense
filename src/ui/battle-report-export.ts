import { appearances, config, stageNames } from '../game/content';
import { buffLabels } from '../game/progression';
import type { BuffId } from '../game/model';
import type { Session } from '../game/session';
import {
  fallTimeline,
  fallTimelineEmpty,
  fallTimelineMissing,
  fallTimelineNote,
} from './fall-timeline';

export type BattleReportDocument = { fileName: string; text: string };

function count(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.floor(value)) : '未记录';
}

function seconds(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(value / 1000).toFixed(2)} 秒`
    : '未记录';
}

/** Export observations only; never settle rewards or create a save. */
export function battleReportDocument(
  session: Session,
  isolated: boolean,
): BattleReportDocument | null {
  const b = session.battle;
  if (
    !b ||
    (session.phase !== 'victory' && session.phase !== 'defeat') ||
    b.result !== session.phase ||
    session.hasChoices ||
    (session.phase === 'victory' && !session.settled)
  )
    return null;
  const win = b.result === 'victory';
  const lines = [
    '# 灵林守阵 · 本场战报',
    '',
    `- 内容版本：${config.contentVersion}`,
    `- 模式：${session.mode === 'campaign' ? '五十关战役' : '初始验证模式'}`,
    `- 来源：${isolated ? '开发隔离试玩' : '正常游戏'}`,
    '',
    '数据为当前原型参数，仍待原活动实机校准。',
    '',
    `## 第${b.stageId}关 · ${stageNames[b.stageId - 1]}`,
    '',
    `- 结果：${win ? '胜利' : '失败'}`,
    `- 用时：${seconds(b.time)}（游戏内模拟时间）`,
    `- 击退：${count(b.kills)}`,
    `- 剩余参战生命：${count(session.totalHealth())}`,
    `- 造成伤害：${count(b.damageDone)}`,
    `- 承受伤害：${count(b.damageTaken)}`,
    `- 击杀经验：${count(b.xpEarned)}`,
    `- 聚灵实际生效：${seconds(b.report?.boostedMs)}`,
    '',
    '## 本关收入',
    '',
  ];
  if (win) {
    lines.push(
      `- 实际入账：${count(session.lastReward + session.lastIncome + session.lastBonus)}`,
      `- 通关 ${count(session.lastReward)} · 产钱/转化 ${count(session.lastIncome)} · 天赋 ${count(session.lastBonus)}`,
    );
  } else {
    lines.push(
      '- 实际入账：0',
      `- 本关产钱 ${count(b.income)} · 转化 ${count(b.fallbackIncome)}（未保留）`,
      '',
      '本关产钱、转化和成长不保留，重试恢复开战前检查点。',
    );
  }
  lines.push(
    '',
    '## 逐兽表现',
    '',
    '| 灵兽 | 位置 | 状态 | 剩余/上限生命 | 伤害 | 承伤 | 施盾 | 吸收 | 产钱 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
  );
  const units = b.allies
    .map((ally) => ({
      ally,
      stats: b.report?.units.find((entry) => entry.id === ally.id),
    }))
    .sort(
      (a, z) => (z.stats?.damageDone ?? -1) - (a.stats?.damageDone ?? -1) || a.ally.id - z.ally.id,
    );
  for (const { ally, stats } of units) {
    lines.push(
      `| ${appearances[ally.kind].name} ${ally.rank}阶 | ${ally.position.x + 1}列${ally.position.y + 1}行 | ${ally.hp > 0 ? '存活' : '重伤'} | ${count(Math.max(0, ally.hp))}/${count(ally.maxHp)} | ${count(stats?.damageDone)} | ${count(stats?.damageTaken)} | ${count(stats?.shieldGiven)} | ${count(stats?.shieldAbsorbed)} | ${count(stats?.income)} |`,
    );
  }
  if (!b.report) lines.push('', '旧战报未记录逐兽数据，各项以「未记录」表示。');
  lines.push(
    '',
    '伤害只计实际扣血，承伤不含护盾吸收；逐兽产钱只计桃的产出，不含转化。缺失字段为未记录，不视为0。',
  );
  const timeline = fallTimeline(b);
  lines.push('', '## 重伤时间线', '');
  if (timeline === null) lines.push(fallTimelineMissing);
  else if (!timeline.length) lines.push(fallTimelineEmpty);
  else lines.push(...timeline.map((line) => `- ${line}`), '', fallTimelineNote);
  lines.push('', '## 备战席（不参战）', '');
  const reserves = session.preparation.units.filter((unit) => !unit.position);
  lines.push(
    ...(reserves.length
      ? reserves.map((unit) => `- ${appearances[unit.kind].name} ${unit.rank}阶`)
      : ['无']),
  );
  lines.push('', '## 结束时累计天赋', '');
  const talents = Object.entries(b.progression.buffs)
    .filter(([, level]) => level > 0)
    .sort(([a], [z]) => a.localeCompare(z));
  lines.push(
    ...(talents.length
      ? talents.map(([id, level]) => `- ${buffLabels[id as BuffId].name}：${level}层`)
      : ['未选择天赋']),
  );
  lines.push(
    '',
    '这是本场复盘文本，不是存档，不能恢复进度或重演操作。继续下一关前请自行保存；本功能不会自动建立历史记录。',
    '',
  );
  return {
    fileName: `ming-defense-report-stage-${b.stageId}-${b.result}.md`,
    text: lines.join('\n'),
  };
}
