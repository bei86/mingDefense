import { appearances, config, stageNames } from '../game/content';
import type { Combat } from '../game/combat-model';
import type { BuffId } from '../game/model';
import { buffLabels } from '../game/progression';
import type { Session } from '../game/session';
import { battleAction } from './battle-action';
import { battleInspection, type InspectedAlly } from './battle-inspection';
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

function allyActionLines(battle: Combat, units: readonly InspectedAlly[]): string[] {
  const lines = ['', '## 灵兽当前行动', ''];
  for (const unit of units) {
    const action = battleAction(battle, unit.id)!;
    lines.push(`- ${positionedAlly(unit)}：${action.status}`);
    if (!action.alive) continue;
    if (action.incomeMs !== null) {
      const timing = action.incomeMs > 0 ? `剩余${enemySeconds(action.incomeMs)}秒` : '待产钱';
      lines.push(`  - 下次产钱：${timing}`);
      continue;
    }
    lines.push(`  - 再次行动最早：${enemySeconds(action.cooldownMs!)}秒后（仅冷却）`);
    if (!action.pending.length) lines.push('  - 当前没有准备中的动作。');
    for (const pending of action.pending) {
      const kind = unit.kind === 'shield_fox' ? '施盾' : '攻击';
      const side = pending.target.side === 'ally' ? '己方' : '敌方';
      const timing =
        pending.remainingMs > 0 ? `准备剩余${enemySeconds(pending.remainingMs)}秒` : '待释放';
      const invalid = pending.targetAlive ? '' : '；目标已倒下或退场，此动作不会生效';
      lines.push(
        `  - 准备${kind} #${pending.ordinal} → ${side} ${pending.targetLabel} · ${timing}${invalid}`,
      );
    }
  }
  if (!units.length) lines.push('无上阵灵兽行动。');
  lines.push(
    '',
    '冷却只表示最早可再次行动；准备到期不等于命中，释放仍受真实战斗规则约束。桃使用独立产钱计时。',
  );
  return lines;
}

function enemyActionLines(enemies: readonly InspectedEnemy[]): string[] {
  const lines = ['', '## 敌人当前普攻', ''];
  for (const enemy of enemies) {
    const action = enemy.attack!;
    const frozen = action.frozenMs > 0;
    lines.push(`- ${enemy.name} #${enemy.id}：${action.status}`);
    if (frozen) lines.push(`  - 冻结剩余${enemySeconds(action.frozenMs)}秒`);
    lines.push(
      `  - ${frozen ? '解冻后再次普攻最早' : '再次普攻最早'}：${enemySeconds(action.cooldownMs)}秒后（仅冷却）`,
    );
    if (!action.pending.length) lines.push('  - 当前没有准备中的普攻。');
    for (const pending of action.pending) {
      const target = pending.target ? positionedAlly(pending.target) : `#${pending.targetId}`;
      let timing =
        pending.remainingMs > 0 ? `准备剩余${enemySeconds(pending.remainingMs)}秒` : '待释放';
      if (frozen) {
        timing = `解冻后准备剩余${enemySeconds(pending.remainingMs)}秒${pending.remainingMs === 0 ? '（待解冻）' : ''}`;
      }
      const invalid = pending.targetAlive ? '' : '；目标已倒下或未记录，此次普攻不会生效';
      lines.push(`  - 准备普攻 → 己方 ${target} · ${timing}${invalid}`);
    }
  }
  if (!enemies.length) lines.push('无存活敌人普攻。');
  lines.push(
    '',
    '准备目标独立于缓存锁定；冻结期间冷却与准备暂停，分列解冻后的剩余时间，不预测命中。',
  );
  return lines;
}

function enemySummonLines(enemies: readonly InspectedEnemy[]): string[] {
  const lines = ['', '## 敌人当前召唤', ''];
  let sources = 0;
  for (const enemy of enemies) {
    const summon = enemy.summon;
    if (!summon) continue;
    sources++;
    let status = '已启用';
    if (!summon.enabled) {
      status = summon.phaseRecorded
        ? `尚未启用 · 进入第二阶段后启用召唤（生命阈值${summon.triggerHpPercent}%）`
        : '阶段未记录，无法确认是否已启用召唤；不按当前生命推测';
    }
    lines.push(`- ${enemy.name} #${enemy.id}：${status}`);
    if (summon.enabled) {
      const frozen = summon.frozenMs > 0;
      let timer = frozen ? '待解冻' : '待判定';
      if (summon.remainingMs === null) timer = '召唤计时未记录';
      else if (summon.remainingMs > 0) timer = `剩余${enemySeconds(summon.remainingMs)}秒`;
      lines.push(`  - ${frozen ? '解冻后召唤计时' : '下次召唤判定'}：${timer}`);
      if (frozen) lines.push(`  - 冻结剩余${enemySeconds(summon.frozenMs)}秒`);
      if (!summon.phaseRecorded) lines.push('  - 阶段未记录，单次数量按未强化参数显示。');
    }
    lines.push(
      `  - 直属存活咒影：${summon.living}/${summon.cap}只`,
      `  - 单次召唤参数：${summon.count}只咒影；后续间隔：${enemySeconds(summon.intervalMs)}秒`,
    );
  }
  if (!sources) lines.push('当前无存活召唤来源。');
  lines.push(
    '',
    '只统计各来源直属存活咒影，不含其他来源、孙代或分裂碎片。到点按空位结算，满额时本次可能不生成，之后仍按周期再判定。计时不是生成保证，未生成召唤物不计入固定队列。',
  );
  return lines;
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
    ...allyActionLines(battle, view.allies),
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
  lines.push(...enemyActionLines(enemies), '', '## 横扫与回响预警', '');
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
    ...enemySummonLines(enemies),
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
    '这是本次暂停观察文本，不是完整行动记录或存档，不能恢复进度或重演操作。包含当前准备队列，不包含完整已发出攻击与持续效果，不能据此还原全部战斗过程。继续守卫后请重新打开战场详情导出新快照。',
    '',
  );
  return {
    fileName: `ming-defense-snapshot-stage-${battle.stageId}-time-${battle.time}ms.md`,
    text: lines.join('\n'),
  };
}
