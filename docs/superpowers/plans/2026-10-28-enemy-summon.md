# 敌人当前召唤状态 Implementation Plan

> 用户持续授权本会话自主实施、自审和验收；不派代理，新开发留待下次提交。

**Goal:** 暂停查看敌人实例的真实召唤计时、阶段与直属存活容量。

**Architecture:** enemySummon纯投影读取Combat与关卡配置，enemyInspection附带该模型；EnemySummon复用折叠样式，由EnemyInspection按实例key管理生命周期。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-summon-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式容量、素材、依赖和默认命令。

## Review Focus

1. 满额到点仍推进下次周期，不显示必定出怪或错误的无限等待。
2. 冻结顺延计时与冻结剩余分开，0/1ms和解冻边界不混淆。
3. 未进入二阶段不能按低血推测开启，强化不提前重置已有周期。
4. 同名/来源0/其他来源/死亡/孙代/分裂计数隔离；缺阶段或计时不补造信息。
5. 普通敌人隐藏，切实例收起、档案返回保留，窄屏可读且键盘可用。

## Task 1：只读模型和接入

**Files:** 新增src/ui/enemy-summon.ts、EnemySummon.tsx、enemy-summon.test.tsx；修改enemy-inspection.ts、EnemyInspection.tsx。

**Interfaces:** `enemySummon(battle:Combat|null,enemyId:number):EnemySummonModel|null`，模型含kind、enabled、phaseRecorded、triggerHpPercent、remainingMs、frozenMs、intervalMs、count、living、cap；EnemySummon接收model，EnemySummonContent供SSR验证。

- [x] 写真实计时/生成/阶段/冻结/容量/旧数据/边界/只读/SSR测试，先运行确认缺失模块失败。
- [x] 实现严格种类/存活/owner过滤，区分未启用、缺字段、冻结与到点状态，保留真实nextSummon。
- [x] 实现默认收起组件，按需渲染内容；enemyInspection接入模型，EnemyInspection按id重置。
- [x] 定向召唤、敌人属性/详情/衍生来源回归和typecheck通过。

## Task 2：验收和记录

**Files:** README.md、docs/reviews/2026-10-28-enemy-summon.md。

- [x] React/simplify自审；全量测试、build、显式启动边界、Prettier与diff检查通过。
- [x] 独立自然试玩验证召唤前后/暂停/档案返回/切实例/键盘/390/320截图及日志，不修改正式进度。
- [x] 完成README/验收/计划，明确未真机等边界；恢复视口、清理试玩并保留正式页面。
