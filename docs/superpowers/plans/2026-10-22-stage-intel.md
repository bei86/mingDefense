# 关卡敌情手册 Implementation Plan

> 本轮使用 Native 执行方式，依次实现并自查，不派生代理，不自动提交新功能。

**Goal:** 从整备和暂停打开50关只读敌情，提供与实际战斗一致的数值及出场排程。

**Architecture:** `stage-intel.ts` 读取 content 和 waveSpawns，返回固定敌人、衍生敌人和首领资料；`StageIntel.tsx` 管理浏览关卡，复用现有弹窗样式。App只保存弹窗开关。

**Tech Stack:** React19、TypeScript、Vite、Vitest；无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-stage-intel-design.md`

## Global Constraints

- 不调整战斗数值、出怪、经济、随机种子、Session或存档版本。
- 所有数值为当前原型参数，不能当作原作结论。
- 手机竖屏优先，弹窗内部滚动；浏览关卡不改变实际进度。
- 暂停查阅后保持暂停，缺图显示文字徽记。

## Review Focus

- 1/50关边界禁用前/后按钮；非法关卡在模型入口拒绝。
- 普通怪倍数与首领独立值分别对照真实 spawnEnemy；普攻按现有 Math.round。
- 衍生怪不叠加进固定出场数，召唤数量不伪装成整关总数。
- 查看其他关卡不写入Session，选框进入焦点循环，关闭回到入口。
- 320宽不横向溢出，50关长文能滚动到底部关闭。

## Task 1: 只读敌情模型

Files: create `src/ui/stage-intel.ts`, `src/ui/stage-intel.test.ts`.

- [x] 写50关参数化测试：`stageIntel(id)`固定数量等于`waveSpawns(id).length`；所有条目的生命等于`spawnEnemy(createCombat([], {stageId:id}),kind,{x:0,y:0}).hp`。
- [x] 覆盖1/6关狼狂暴、召唤和分裂归属、首领横扫及非法关卡0/51/小数。
- [x] 实现模型，直接从配置读数值，按`Math.round(base * multiplier)`计算普通怪，首领独立值。
- [x] 执行 `npx.cmd vitest run src/ui/stage-intel.test.ts`。

## Task 2: 手册与入口

Files: create `src/ui/StageIntel.tsx`, `src/ui/stage-intel.css`; modify `App.tsx`, `CombatPanels.tsx`, `useModalFocus.ts`, `main.tsx`.

- [x] 实现关卡选择：`useState(currentStageId)`，前后按钮与`select`只调用本地`setStageId`。
- [x] 渲染总览、固定出场卡片、衍生卡片、首领规则和来源说明；素材来自enemyArt/bossArtKey，无图用徽记。
- [x] 接入整备EnemyIntel与PauseMenu；App顶层焦点与暂停覆盖状态加入intel。
- [x] 选框加入焦点循环，复用手机模态滚动，卡片单列。

## Task 3: 验收与交付

Files: modify `README.md`; create `docs/reviews/2026-10-22-stage-intel.md`.

- [x] 使用simplify技能自查新代码，避免复制战斗逻辑和无关抽象。
- [x] 全量测试、构建、Prettier和git diff --check。
- [x] 使用浏览器实际操作1/50关、320/390宽、暂停打开/关闭，记录截图与测试边界。
- [x] 更新文档与计划勾选，汇报先前提交哈希与新功能结果。
