# 暂停详情逐只翻看 Implementation Plan

> 用户持续授权在本会话实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 按当前筛选与排序逐只翻看暂停灵兽和敌人。

**Architecture:** inspectionNeighbors(entries, selectedId)派生相邻编号及当前位置；无状态InspectionNavigation将编号回传原onSelect，AllySelection/EnemySelection在下拉框后复用，不新增会话状态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-inspection-navigation-design.md

## Global Constraints

保持规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖、默认命令。

## Review Focus

1. 邻居来自当前筛选/排序，不是源数组、编号相邻或其他种类。
2. 编号0有效，首尾不循环，缺编号不能导航到错误实例。
3. 空或单只无按钮，种类/排序变化后序号立即派生。
4. 图鉴/档案往返保持实例，按钮不抢焦点；边界禁用项跳过Tab。
5. 320宽度按钮触控44px、计数可读且无横溢。

## Task 1：邻居模型、受控按钮与接入

**Files:** 新增src/ui/inspection-navigation.ts、src/ui/InspectionNavigation.tsx、src/ui/inspection-navigation.test.tsx；修改src/ui/AllySelection.tsx、src/ui/EnemySelection.tsx、src/ui/battle-inspection.css。

**Interface:** inspectionNeighbors(entries: readonly {id:number}[], selectedId: number | undefined)返回{position,total,previousId,nextId}或null；InspectionNavigation接收entries/selectedId/subject/onSelect。

- [x] 先写邻居边界、真实投影筛选排序与SSR失败测试，运行 `npx vitest run src/ui/inspection-navigation.test.tsx` 确认缺模块失败。
- [x] 模型按findIndex派生，<=1只或编号失效返回null；按钮禁用首尾，不循环，仅把相邻编号传原onSelect。
- [x] 在双方实例select后接入，三列布局、44px按钮；执行新增与现有选择/排序/锁定测试及typecheck。

## Task 2：完整验收与记录

**Files:** README.md、docs/reviews/2026-10-28-inspection-navigation.md。

- [x] React/simplify自审；全量、build及显式CHECK_STARTUP_BUILD=1启动检查、Prettier和git diff --check。
- [x] Chrome独立第50关自然暂停，双方逐只翻看，核对筛选/排序后邻居、同名编号、单只/空态、图鉴/档案往返、键盘和390/320截图，恢复视口并清理试玩。
- [x] 正式档只读核对，更新README与验收文档，计划勾选，新开发留工作区。
