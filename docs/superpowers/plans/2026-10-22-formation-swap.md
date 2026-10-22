# 灵兽换位实现计划

**Goal:** 允许整备期原子交换两只已有灵兽，并保留形状校验、撤销和存档。

**Architecture:** Session共享只读swapError校验与edit命令；FormationSwap单独呈现候选，App接入既有模态管理。

**Tech Stack:** React 19、TypeScript、Vitest、现有CSS与Phaser棋盘。

**Spec:** `docs/superpowers/specs/2026-10-22-formation-swap-design.md`

## 约束与审查重点

不改内容v24/schema2、数值、随机数和旧移动/合成；无依赖；中文界面；原生执行本计划，新功能留工作区审阅。

重点：双方新形状互相重叠、源位置变空、满备战席对调、失败保留上一步撤销、存档仍可加载；对应Session测试。

## Task 1: 原子换位

- [x] 新建`src/game/formation-swap.test.ts`。覆盖设计验收的合法和失败场景，先运行新测试确认缺少接口。
- [x] `src/game/session.ts`导出`swapError(p: Preparation, sourceId: number, targetId: number): string | null`，在只读副本上交换位置，再调用placementError检查双方。
- [x] 新增`Session.swap(sourceId: number, targetId: number): string | null`，通过edit校验后交换位置。失败不消耗undo/revision，成功保留一步撤销。
- [x] 运行`npx.cmd vitest run src/game/formation-swap.test.ts`，核对完整阵容/经济/RNG不被预览或拒绝命令修改。

## Task 2: 换位面板

- [x] 创建`src/ui/FormationSwap.tsx`和`formation-swap.css`，显示来源与候选双向位置、禁用原因、空列表和关闭入口。
- [x] 修改`PreparationPanel.tsx`为已选已有灵兽提供换位入口；App加入source ID、模态焦点、提交/关闭回调；main导入样式。
- [x] 实际浏览器检查合法换位、非法提示、关闭不修改、撤销、满席、键盘、320/390宽度；保存截图。

## Task 3: 验收与交付

- [x] 用React最佳实践与simplify检查新增组件和状态，运行全量Vitest、构建、Prettier及diff检查。
- [x] README记录操作与边界，写`docs/reviews/2026-10-22-formation-swap.md`列出实测与未验证项。
- [x] 新功能不自动提交或推送；向用户报告已完成旧提交哈希与新功能结果。
