# 战场快照当前行动 Implementation Plan

> 用户持续授权本人自主实施、自审和验收，不派代理；本轮新开发留工作区，下轮提交。

**Goal:** 让暂停快照包含双方真实准备动作及冷却/产钱状态。

**Architecture:** battle-snapshot.ts复用battleAction与已读取enemyInspection.attack，输出两个独立Markdown章节；BattleSnapshot只更新说明，复用原导出流程。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-snapshot-actions-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖和默认命令。不派代理、不推送，新开发不提交。

## Review Focus

1. 目标所属阵营明确，双方同号和0不混淆，缓存锁定不能冒充准备目标。
2. 冻结、冷却、准备与桃产钱是不同计时，不推断下次命中。
3. 倒下来源旧准备不列，存活来源的失效目标保留编号及无效说明。
4. 多动作按原投影排序，重复读取不改Session、数组和RNG。
5. 全部实例不受筛选/页签影响；复用原窄屏、复制、下载与手动文本操作。

## Task 1：当前行动文本

**Files:** 修改src/ui/battle-snapshot.ts；新增src/ui/snapshot-actions.test.tsx。

**Interfaces:** 保持battleSnapshotDocument(session:Session,isolated:boolean):BattleSnapshotDocument|null不变；私有allyActionLines(battle:Combat,units:readonly InspectedAlly[]):string[]与enemyActionLines(enemies:readonly InspectedEnemy[]):string[]生成章节。

- [x] 先写真实Combat/Session攻击/释放、施盾、产钱/倒下、阵营同号/0、多个准备/无效目标、冻结/0剩余、排序与只读测试，确认旧快照缺章节失败。
- [x] 灵兽章节复用battleAction，目标前加己方/敌方；敌方章节使用enemy.attack。0时间为待释放，不生成伤害/命中预测。

```ts
const model = battleAction(battle, unit.id)!;
const actionKind = unit.kind === 'shield_fox' ? '施盾' : '攻击';
const side = action.target.side === 'ally' ? '己方' : '敌方';
```

- [x] 章节各自跟在所属阵营生命表后。更新末尾覆盖范围说明：含当前准备队列，不含完整已发出攻击与持续效果。

## Task 2：接入、自审和验收

**Files:** 修改src/ui/BattleSnapshot.tsx、README.md；新增docs/reviews/2026-10-28-snapshot-actions.md。

- [x] 更新快照介绍，SSR核对默认收起与正文，定向测试/typecheck及React/simplify自审。
- [x] 全量test/build、CHECK_STARTUP_BUILD=1、格式/diff检查。
- [x] 独立stage50自然开战暂停，动作与面板对照、筛选/切页/重开、320/390尺寸及截图；清理试玩/视口，正式页只读核对。图鉴/档案往返、系统剪贴板读回和下载落地本轮未重复，边界记入验收。
- [x] 更新README、验收文档与计划，本轮新开发留工作区。

## 验证命令

```powershell
npx.cmd vitest run src/ui/snapshot-actions.test.tsx src/ui/battle-snapshot.test.tsx src/ui/battle-action.test.ts src/ui/enemy-attack.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
