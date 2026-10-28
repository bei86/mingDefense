# 快照召唤状态 Implementation Plan

> 用户已授权当前会话顺序实施、自审和验收；不派代理，不自动提交本轮新开发或推送。

**Goal:** 在暂停快照中准确记录各存活召唤来源的当前计时和容量。

**Architecture:** battle-snapshot.ts复用已有InspectedEnemy.summon生成独立章节；BattleSnapshot更新说明，沿用TextExport及已有样式。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-snapshot-summons-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、素材、存档、收藏、备份、依赖和默认命令。新开发留工作区。

## Review Focus

1. 缺计时不补0；冻结时间和解冻后计时独立，0不承诺生成。
2. 未转阶段的低生命首领不能提前当作启用；旧缺阶段沿原投影语义。
3. 来源0和同名来源隔离，计数不混入孙代或分裂，满额仍推进周期。
4. 首领强化使用实际phase2，计时不因快照读取而重置。
5. 章节不受筛选/排序/页签影响，读取不修改Session、源数组或RNG。

## Task 1：召唤章节与集成测试

**Files:** 修改src/ui/battle-snapshot.ts、src/ui/BattleSnapshot.tsx；新增src/ui/snapshot-summons.test.tsx。

**Interfaces:** 保留battleSnapshotDocument(session:Session,isolated:boolean):BattleSnapshotDocument|null；私有enemySummonLines(enemies:readonly InspectedEnemy[]):string[]只读取enemy.summon。

- [x] 新增真实Combat/Session测试并确认旧实现因缺章节失败：普通召唤0到点后生成并刷新计时；早期首领低血未转阶段仍未启用，step后启用；晚期首领phase2强化不重置既有计时；冻结步保持召唤计时，解冻后继续。

```ts
const { session, battle, enemy } = setup('summoner');
battle.time = enemy.nextSummon!;
expect(section(session)).toContain('下次召唤判定：待判定');
stepCombat(battle);
expect(section(session)).toContain(`直属存活咒影：${enemyDefinitions.summoner.skills.summonCount}/`);
```

- [x] 加入满额、单空位、同名与编号0隔离、死亡来源、missing/0/1ms、空态/SSR、排序和完整Session只读断言。
- [x] 实现独立章节及介绍，复用已有投影，无新引擎计算。

```ts
for (const enemy of enemies) {
  const summon = enemy.summon;
  if (!summon) continue;
  lines.push(`- ${enemy.name} #${enemy.id}`);
}
```

- [x] 定向运行snapshot-summons、snapshot-actions、battle-snapshot、enemy-summon及typecheck；React/simplify自审检查空值、阵营与只读。

## Task 2：验证与文档

**Files:** 修改README.md；新增docs/reviews/2026-10-28-snapshot-summons.md。

- [x] 全量test与build，CHECK_STARTUP_BUILD=1启动边界，Prettier和git diff --check。
- [x] Chrome独立stage50自然开战暂停，召唤面板/正文对照；实际390宽度、手动选择、切页/筛选保持、关闭重开及截图。记录真实可验证边界，恢复视口并关闭新试玩；正式页只读核对。
- [x] 更新README与验收文档、勾选计划，新开发留工作区。

```powershell
npx.cmd vitest run src/ui/snapshot-summons.test.tsx src/ui/snapshot-actions.test.tsx src/ui/battle-snapshot.test.tsx src/ui/enemy-summon.test.tsx
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
