import { appearances, bossName, center, config, distance, enemyAppearances } from '../game/content';
import type { Combat } from '../game/combat';
import { heroRange } from '../game/combat-skills';

export type BattleActionTarget = { side: 'ally' | 'enemy'; id: number };

export type BattleActionModel = {
  alive: boolean;
  status: string;
  cooldownMs: number | null;
  incomeMs: number | null;
  pending: {
    ordinal: number;
    targetLabel: string;
    targetAlive: boolean;
    target: BattleActionTarget;
    remainingMs: number;
  }[];
};

/** A snapshot only: cooling down and preparing an action are separate clocks. */
export function battleAction(battle: Combat | null, unitId: number): BattleActionModel | null {
  const ally = battle?.allies.find((unit) => unit.id === unitId);
  if (!battle || !ally) return null;
  const model: BattleActionModel = {
    alive: ally.hp > 0,
    status: '已倒下，本关不再行动',
    cooldownMs: null,
    incomeMs: null,
    pending: [],
  };
  if (!model.alive) return model;
  if (ally.kind === 'fortune_peach') {
    model.incomeMs = Math.max(0, (ally.incomeAt ?? 0) - battle.time);
    model.status = model.incomeMs > 0 ? '等待产钱' : '待产钱';
    return model;
  }

  // The next simulation step decrements cooldown before checking readiness.
  model.cooldownMs = Math.max(0, ally.cooldown - config.runtime.tickMs);
  model.status = '冷却中';
  if (model.cooldownMs === 0) {
    if (ally.kind === 'shield_fox') {
      model.status = '已就绪 · 恢复后选择施盾目标';
    } else {
      const point = center(ally.kind, ally.position);
      const hasTarget = battle.enemies.some(
        (enemy) => enemy.hp > 0 && distance(point, enemy) <= heroRange(ally, battle.progression),
      );
      model.status = hasTarget ? '已就绪 · 恢复后可发起攻击' : '已就绪 · 等待范围内敌人';
    }
  }
  model.pending = battle.attacks
    .filter((attack) => attack.team === 'ally' && attack.source === ally.id)
    .sort((a, b) => a.due - b.due || a.ordinal - b.ordinal || a.target - b.target)
    .map((attack) => {
      let targetLabel = `#${attack.target}`;
      let targetAlive = false;
      if (ally.kind === 'shield_fox') {
        const target = battle.allies.find((unit) => unit.id === attack.target);
        if (target) {
          targetLabel = `${appearances[target.kind].name}${target.rank}阶 · #${target.id}`;
          targetAlive = target.hp > 0;
        }
      } else {
        const target = battle.enemies.find((enemy) => enemy.id === attack.target);
        if (target) {
          const kind = target.kind ?? 'wolf';
          const name = kind === 'boss' ? bossName(battle.stageId) : enemyAppearances[kind].name;
          targetLabel = `${name} · #${target.id}`;
          targetAlive = target.hp > 0;
        }
      }
      return {
        ordinal: attack.ordinal,
        targetLabel,
        targetAlive,
        target: { side: ally.kind === 'shield_fox' ? 'ally' : 'enemy', id: attack.target },
        remainingMs: Math.max(0, attack.due - battle.time),
      };
    });
  return model;
}
