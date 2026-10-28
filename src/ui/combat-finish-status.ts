import type { Combat } from '../game/combat-model';

/** Fixed spawns ending is not victory: summons, deaths and released skills still resolve. */
export function combatFinishStatus(battle: Combat | null): string | null {
  if (!battle || battle.result || battle.spawnIndex !== battle.spawns.length) return null;

  let alive = 0;
  for (const enemy of battle.enemies) if (enemy.hp > 0) alive++;
  if (alive > 0) return `固定敌袭已出完 · 场上 ${alive} 只`;

  if (
    battle.attacks.length ||
    battle.released.length ||
    battle.fields.length ||
    battle.warnings.length
  ) {
    return '固定敌袭已出完 · 招式结算中';
  }
  return '固定敌袭已出完 · 等待战果判定';
}
