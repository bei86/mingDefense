import { bossDefinition, config, distance, enemyDefinitions } from '../game/content';
import type { Ally, Combat } from '../game/combat-model';
import { contact } from '../game/combat-skills';

type AttackTarget = Pick<Ally, 'id' | 'kind' | 'rank' | 'position'>;

export type EnemyAttackModel = {
  status: string;
  frozenMs: number;
  cooldownMs: number;
  pending: {
    remainingMs: number;
    targetId: number;
    target: AttackTarget | null;
    targetAlive: boolean;
  }[];
};

/** Read current basic attacks separately from cached targeting and boss warnings. */
export function enemyAttack(battle: Combat | null, enemyId: number): EnemyAttackModel | null {
  const enemy = battle?.enemies.find((entry) => entry.id === enemyId && entry.hp > 0);
  if (!battle || !enemy) return null;
  const frozenMs = Math.max(0, (enemy.frozenUntil ?? 0) - battle.time);
  // The next unfrozen step decrements cooldown before checking readiness.
  const cooldownMs = Math.max(0, enemy.cooldown - config.runtime.tickMs);
  const target = battle.allies.find((ally) => ally.id === enemy.target && ally.hp > 0);
  let status = '等待重新寻敌';
  if (frozenMs > 0) {
    status = '冻结中 · 普攻暂停';
  } else if (target) {
    const definition =
      enemy.kind === 'boss'
        ? bossDefinition(battle.stageId)
        : enemyDefinitions[enemy.kind ?? 'wolf'];
    if (distance(enemy, contact(target, enemy)) > definition.rangeCells + 1e-9) {
      status = '正在接近锁定目标';
    } else {
      status = cooldownMs > 0 ? '普攻冷却中' : '已就绪 · 已接近锁定目标';
    }
  }
  const pending = battle.attacks
    .filter((attack) => attack.team === 'enemy' && attack.source === enemy.id)
    .sort((a, b) => a.due - b.due || a.target - b.target)
    .map((attack) => {
      const ally = battle.allies.find((unit) => unit.id === attack.target);
      return {
        remainingMs: Math.max(0, attack.due - battle.time),
        targetId: attack.target,
        target: ally
          ? { id: ally.id, kind: ally.kind, rank: ally.rank, position: { ...ally.position } }
          : null,
        targetAlive: !!ally && ally.hp > 0,
      };
    });
  return { status, frozenMs, cooldownMs, pending };
}
