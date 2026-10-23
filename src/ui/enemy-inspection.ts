import { bossName, enemyAppearances, heroes, type EnemyKind } from '../game/content';
import type { Combat } from '../game/combat-model';
import { bonus } from '../game/progression';
import type { InspectedAlly } from './battle-inspection';

export type InspectedEnemy = {
  id: number;
  kind: EnemyKind;
  name: string;
  hp: number;
  maxHp: number | null;
  phase: string | null;
  targetState: 'none' | 'locked' | 'lost';
  target: Pick<InspectedAlly, 'id' | 'kind' | 'rank' | 'position'> | null;
  effects: { label: string; value: string }[];
  warnings: { row: number; remainingMs: number; echo: boolean }[];
  origin: string | null;
  descendants: number;
};

export function enemySeconds(ms: number): string {
  return String(Math.ceil(Math.max(0, ms) / 100) / 10);
}

function enemyName(kind: EnemyKind, stageId: number): string {
  return kind === 'boss' ? bossName(stageId) : enemyAppearances[kind].name;
}

/** Project living instances without advancing the battle or predicting their next action. */
export function enemyInspection(
  battle: Combat | null,
): { enemies: InspectedEnemy[]; initialId: number | undefined } | null {
  if (!battle) return null;
  const living = battle.enemies.filter((enemy) => enemy.hp > 0);
  const globalSlow = bonus(battle.progression, 'slow');
  const enemies: InspectedEnemy[] = living.map((enemy) => {
    const kind = enemy.kind ?? 'wolf';
    const target = battle.allies.find((ally) => ally.id === enemy.target && ally.hp > 0);
    const effects: InspectedEnemy['effects'] = [];
    const remaining = (until: number | undefined) =>
      `剩余 ${enemySeconds((until ?? 0) - battle.time)} 秒`;
    if ((enemy.frozenUntil ?? 0) > battle.time) {
      effects.push({ label: '冻结', value: remaining(enemy.frozenUntil) });
    }
    if ((enemy.slowUntil ?? 0) > battle.time) {
      effects.push({
        label: '霜尾缓行',
        value: `${heroes.ice_fish.skills.slowPercent}% · ${remaining(enemy.slowUntil)}`,
      });
    }
    if ((enemy.vulnerabilityUntil ?? 0) > battle.time) {
      const percent = enemy.vulnerabilityPercent;
      const value = percent === undefined ? '倍率未记录' : `${percent}%`;
      effects.push({ label: '易伤', value: `${value} · ${remaining(enemy.vulnerabilityUntil)}` });
    }
    if (globalSlow > 0) effects.push({ label: '迟滞天赋', value: `移速 -${globalSlow}%` });
    let phase: string | null = null;
    if (kind === 'boss') {
      phase = '阶段未记录';
      if (enemy.phase2 !== undefined) phase = enemy.phase2 ? '第二阶段' : '第一阶段';
    }
    let origin: string | null = null;
    if (enemy.owner !== undefined) {
      const parent = living.find((entry) => entry.id === enemy.owner);
      origin = parent
        ? `${enemyName(parent.kind ?? 'wolf', battle.stageId)} #${parent.id}`
        : `#${enemy.owner}（来源已退场或未记录）`;
    }
    let targetState: InspectedEnemy['targetState'] = 'none';
    if (enemy.target !== null) targetState = target ? 'locked' : 'lost';
    return {
      id: enemy.id,
      kind,
      name: enemyName(kind, battle.stageId),
      hp: Math.ceil(enemy.hp),
      maxHp:
        enemy.maxHp !== undefined && Number.isFinite(enemy.maxHp) && enemy.maxHp > 0
          ? enemy.maxHp
          : null,
      phase,
      targetState,
      target: target
        ? { id: target.id, kind: target.kind, rank: target.rank, position: { ...target.position } }
        : null,
      effects,
      warnings: battle.warnings
        .filter((warning) => warning.source === enemy.id)
        .sort((a, b) => a.due - b.due)
        .map((warning) => ({
          row: warning.row + 1,
          remainingMs: Math.max(0, warning.due - battle.time),
          echo: warning.echo ?? false,
        })),
      origin,
      descendants: living.filter((child) => child.owner === enemy.id).length,
    };
  });
  enemies.sort((a, b) => Number(b.kind === 'boss') - Number(a.kind === 'boss') || a.id - b.id);
  return { enemies, initialId: enemies[0]?.id };
}
