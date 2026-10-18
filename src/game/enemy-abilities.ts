import { bossDefinition, enemyDefinitions } from './content';
import type { Combat, Enemy } from './combat-model';
import { spawnEnemy } from './combat-skills';

function summon(s: Combat, parent: Enemy, count: number, cap: number): void {
  const living = s.enemies.filter(
    (e) => e.hp > 0 && e.kind === 'summoned_wolf' && e.owner === parent.id,
  ).length;
  const spacing = count === 2 ? 0.6 : 0.3;
  for (let i = 0; i < Math.min(count, cap - living); i++)
    spawnEnemy(
      s,
      'summoned_wolf',
      { x: Math.max(0.2, Math.min(5.8, parent.x + (i - (count - 1) / 2) * spacing)), y: parent.y },
      parent.id,
    );
}
export function updateBossPhase(s: Combat): void {
  const skill = bossDefinition(s.stageId);
  for (const boss of s.enemies.filter((e) => e.kind === 'boss' && e.hp > 0)) {
    if (!boss.phase2 && boss.hp <= (skill.hp * skill.phase2HpPercent) / 100) {
      boss.phase2 = true;
      if (!skill.summonFromStart) boss.nextSummon = s.time;
    }
    if (
      (skill.summonFromStart || boss.phase2) &&
      (boss.frozenUntil ?? 0) <= s.time &&
      s.time >= (boss.nextSummon ?? 0)
    ) {
      const count = boss.phase2
        ? (skill.phase2SummonCount ?? skill.summonCount)
        : skill.summonCount;
      summon(s, boss, count, skill.maxLivingSummons);
      boss.nextSummon = s.time + skill.summonIntervalMs;
    }
  }
}
export function updateSummoner(s: Combat, enemy: Enemy): void {
  if (enemy.kind !== 'summoner' || enemy.hp <= 0 || s.time < (enemy.nextSummon ?? Infinity)) return;
  const skill = enemyDefinitions.summoner.skills;
  summon(s, enemy, skill.summonCount!, skill.maxLivingSummons!);
  enemy.nextSummon = s.time + skill.summonEveryMs!;
}
