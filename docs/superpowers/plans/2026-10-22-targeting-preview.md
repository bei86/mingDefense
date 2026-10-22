# 整备受击顺序预览实现计划

**Goal:** 帮助玩家按实战逐排寻敌规则判断当前站位的首目标与静态后续顺序。

**Architecture:** 只读`targetingPreview`构建临时存活单位，复用`enemyTarget`逐次移除；Battlefield保存本页展开及参考列，TargetingPanel与TargetingOverlay分别呈现文本和棋盘标记。

**Tech Stack:** React 19、TypeScript、SVG、Vitest、现有Phaser棋盘。

**Spec:** `docs/superpowers/specs/2026-10-22-targeting-preview-design.md`

## 全局约束与复查重点

不改战斗、数值、经济、RNG、v24/schema2；无依赖和新素材；原生执行，新功能留工作区审阅。

重点：距离按完整占格最近点而非中心；长灵兽归最上排；参考点固定不是战斗预测；备战席不参战；选择和悬停不写进阵容。分别在模型测试和实际浏览器中验证。

## Task 1: 只读模型

- [x] 新建`src/ui/targeting-preview.test.ts`，覆盖实战寻敌、规则优先级、多格、非参战单位、空阵容、兜底、swap/undo/merge后刷新与Preparation完整不变。
- [x] 新建`targeting-preview.ts`，导出`targetingPreview(p: Preparation, column: number): TargetingPreview`及条目/行类型。临时Ally复制位置并使用真实最大生命，反复调用enemyTarget，输出rows/first/reference/column。
- [x] 运行`npx.cmd vitest run src/ui/targeting-preview.test.ts`，确认新增模型与实际stepCombat寻敌一致。

## Task 2: 面板与标记

- [x] 新建`TargetingPanel.tsx`、`targeting-preview.css`：折叠按钮、实际出怪列、首目标摘要、逐排列表、参考条件与空阵容说明。
- [x] 新建`src/render/TargetingOverlay.tsx`，用360×416与52px/格对齐，只描前排占格与首目标；不接收指针。
- [x] 修改Battlefield，useState保存展开及参考列，按phase门控计算与呈现，展开隐藏原range模型；main导入CSS。
- [x] 浏览器检查默认折叠、切列、范围恢复、键盘、换位/撤销更新、空阵容、320/390宽与战斗/暂停隐藏，保存截图。

## Task 3: 验收

- [x] 用React最佳实践与simplify自查新增状态与派生数据，运行全量测试、构建、Prettier和diff检查。
- [x] README加使用说明，新增`docs/reviews/2026-10-22-targeting-preview.md`，明确浏览器与真机验证边界。
- [x] 报告已完成旧提交与新开发结果，不提交或推送本轮新功能。
