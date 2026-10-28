# 灵兽横扫预警来源 Implementation Plan

> 用户持续授权当前会话自主实施、自审和验收；本轮不派代理，新开发留待下次提交。

**Goal:** 从所选灵兽直接查看并定位当前波及它的横扫/回响预警。

**Architecture:** allyWarnings从enemyInspection已有波及名单生成独立只读模型，AllyWarnings复用折叠与链接样式，BattleInspection用单个敌人目标对象管理实例和可选预警定位。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-ally-warnings-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 跨行多格每条预警只计一次，缓存锁定与实际普攻不能充当横扫依据。
2. 同名首领/编号0、同排双段准确隔离，排序不承诺命中顺序。
3. 冻结准备保持、冻结剩余下降；0/1ms/到期边界不误报释放。
4. 倒下/退场首领与灵兽、备战和缺失对象无条目；读取不改战斗或原投影。
5. 精确跳转后对应名单展开，普通导航清除上下文；窄屏换行、键盘和暂停保持。

## Task 1：模型、列表与接入

**Files:** 新增src/ui/ally-warnings.ts、AllyWarnings.tsx、ally-warnings.test.tsx；修改BattleInspection.tsx。

**Interfaces:** `allyWarnings(view:EnemyInspectionView|null,unitId:number):AllyWarning[]`，AllyWarning含source的id/name及row/echo/remainingMs/frozenMs；AllyWarnings接收warnings和onSelect(BossWarningTarget)。

- [x] 编写真实横扫生成/释放、完整占格、同名/0编号与双段、冻结/边界、失效对象、只读与SSR测试；运行确认缺失模块失败。
- [x] 实现boss且warning.allies.some(id)反向查询，返回独立来源对象，按来源/行/段/准备排列。
- [x] 实现默认收起列表、冻结双时钟和空说明，复用inspection-links.css；点击仅传source/row/echo。
- [x] BattleInspection接入，合并敌人编号和预警上下文；点击时按当前所选灵兽重验匹配，成功后聚焦敌人，普通导航清除上下文。
- [x] 定向新测试和原详情/预警/跳转测试、typecheck通过。

## Task 2：验收与记录

**Files:** README.md、docs/reviews/2026-10-28-ally-warnings.md。

- [x] React/simplify自审、全量测试、构建、显式启动边界、Prettier和diff检查。
- [x] 独立自然第50关验证预警名单、对应行/段定位、原行内名单返回、图鉴/档案与普通导航；390/320截图目视、键盘和日志检查。
- [x] README及验收记录明确实测和未测边界，完成计划，恢复视口并清理隔离试玩。
