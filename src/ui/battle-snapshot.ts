import { appearances, config, stageNames } from '../game/content';
import type { BuffId } from '../game/model';
import { buffLabels } from '../game/progression';
import type { Session } from '../game/session';
import { battleInspection } from './battle-inspection';
import { enemyInspection, enemySeconds, type InspectedEnemy } from './enemy-inspection';
import { upcomingEnemies } from './upcoming-enemies';

export type BattleSnapshotDocument = { fileName: string; text: string };
type AllyLabel = { id: number; kind: keyof typeof appearances; rank: number };

function allyLabel(unit: AllyLabel): string {
  return `${appearances[unit.kind].name} #${unit.id} · ${unit.rank}阶`;
}

function positionedAlly(unit: AllyLabel & { position: { x: number; y: number } }): string {
  return `${allyLabel(unit)} · ${unit.position.x + 1}列${unit.position.y + 1}行`;
}

function targetLabel(enemy: InspectedEnemy): string {
  if (enemy.target) return positionedAlly(enemy.target);
  return enemy.targetState === 'lost' ? '目标已倒下或退场' : '尚未锁定';
}

/** A deterministic observation document, never a save or a replay. */
export function battleSnapshotDocument(
  session: Session,
  isolated: boolean,
): BattleSnapshotDocument | null {
  const battle = session.battle;
  if (
    !battle ||
    session.phase !== 'combat' ||
    !session.paused ||
    session.hasChoices ||
    battle.pendingChoices > 0 ||
    battle.result !== null
  )
    return null;
  const view = battleInspection(battle, session.preparation.units)!;
  const enemies = enemyInspection(battle)!.enemies;
  const upcoming = upcomingEnemies(battle)!;
  const lines = [
    '# 灵林守阵 · 暂停战场快照',
    '',
    `- 内容版本：${config.contentVersion}`,
    `- 模式：${session.mode === 'campaign' ? '五十关战役' : '初始验证模式'}`,
    `- 来源：${isolated ? '开发隔离试玩' : '正常游戏'}`,
    `- 关卡：第${battle.stageId}关 · ${stageNames[battle.stageId - 1]}`,
    `- 游戏内时间：${(battle.time / 1000).toFixed(2)} 秒（已暂停）`,
    `- 存活上阵：${view.aliveCount} / ${view.allies.length}；存活敌人：${enemies.length}`,
    `- 已出队列：${battle.spawnIndex} / ${battle.spawns.length}；尚未出场：${upcoming.remaining}`,
    `- 击退：${battle.kills}`,
    '',
    '数据为当前原型参数，仍待原活动实机校准。包含全部实例，不受战场详情筛选、排序或页签影响。',
    '',
    '## 上阵灵兽',
    '',
    '| 灵兽与编号 | 锚点位置 | 状态 | 当前/上限生命 | 当前有效护盾 | 缓存锁定数 |',
    '| --- | --- | --- | ---: | --- | ---: |',
  ];
  for (const unit of view.allies) {
    lines.push(
      `| ${allyLabel(unit)} | ${unit.position.x + 1}列${unit.position.y + 1}行 | ${unit.alive ? '存活' : '已倒下'} | ${unit.hp}/${unit.maxHp} | ${unit.shield > 0 ? `${unit.shield}（剩余${unit.shieldSeconds}秒）` : '0'} | ${unit.targetedBy} |`,
    );
  }
  if (!view.allies.length) lines.push('', '无上阵灵兽。');
  lines.push(
    '',
    '生命和护盾沿详情面板取整；过期、耗尽或倒下者的旧盾不计。位置是完整占格的锚点。',
    '',
    '## 存活敌人',
    '',
    '| 敌人与编号 | 当前/上限生命 | 阶段 | 当前缓存目标 | 有效状态 | 衍生来源 |',
    '| --- | ---: | --- | --- | --- | --- |',
  );
  for (const enemy of enemies) {
    lines.push(
      `| ${enemy.name} #${enemy.id} | ${enemy.hp}/${enemy.maxHp ?? '未记录'} | ${enemy.phase ?? '不适用'} | ${targetLabel(enemy)} | ${enemy.effects.map((effect) => `${effect.label}：${effect.value}`).join('；') || '无'} | ${enemy.origin ?? '无衍生来源记录'} |`,
    );
  }
  if (!enemies.length) lines.push('', '无存活敌人。');
  lines.push('', '## 横扫与回响预警', '');
  let warningCount = 0;
  for (const enemy of enemies) {
    for (const warning of enemy.warnings) {
      warningCount++;
      const timing =
        warning.frozenMs > 0
          ? `冻结剩余${enemySeconds(warning.frozenMs)}秒 · 解冻后准备剩余${enemySeconds(warning.remainingMs)}秒`
          : `准备剩余${enemySeconds(warning.remainingMs)}秒`;
      lines.push(
        `- ${enemy.name} #${enemy.id} · 第${warning.row}行 · ${warning.echo ? '回响' : '横扫'} · ${timing}；当前波及：${warning.allies.map(positionedAlly).join('、') || '无存活灵兽'}`,
      );
    }
  }
  if (!warningCount) lines.push('当前没有已记录预警。');
  lines.push(
    '',
    '锁定包含接近中的目标，与准备普攻不同；预警只列已记录行与当前波及对象，不是伤害预测。冻结剩余与解冻后的准备剩余分别计时。',
    '',
    '## 尚未出场的队列',
    '',
    ...upcoming.counts.map((entry) => `- ${entry.name}：${entry.count}只`),
  );
  if (!upcoming.remaining) lines.push('无尚未出场的队列项目。');
  lines.push(
    '',
    '只计真实队列未消费项目，不包含未来可能产生的召唤物或分裂碎片。',
    '',
    '## 备战席（不参战）',
    '',
    ...(view.reserves.length ? view.reserves.map((unit) => `- ${allyLabel(unit)}`) : ['无']),
    '',
    '## 当前累计天赋',
    '',
  );
  const talents = Object.entries(battle.progression.buffs)
    .filter(([, level]) => level > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  lines.push(
    ...(talents.length
      ? talents.map(([id, level]) => `- ${buffLabels[id as BuffId].name}：${level}层`)
      : ['未选择天赋']),
    '',
    '这是本次暂停观察文本，不是完整行动记录或存档，不能恢复进度或重演操作。不包含完整准备/已发出攻击与持续效果，不能据此还原全部战斗过程。继续守卫后请重新打开战场详情导出新快照。',
    '',
  );
  return {
    fileName: `ming-defense-snapshot-stage-${battle.stageId}-time-${battle.time}ms.md`,
    text: lines.join('\n'),
  };
}
