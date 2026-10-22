# 布阵范围预览 Implementation Plan

> Native执行：本会话依次实现、测试和自查，不派生代理，不自动提交本轮新功能。

**Goal:** 整备时直观查看攻击、施盾和光环范围，辅助调整站位。

**Architecture:** 纯函数读取Preparation、Source、hover、dragOffset和maxRank，返回投影位置、有效性、圆与覆盖伙伴。SVG图层复用360×416整备坐标并裁剪到棋盘，说明置于棋盘下方。

**Tech Stack:** React19 / TypeScript / SVG / Vitest，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-preparation-range-design.md`

## Global Constraints

- 不改模拟、经济、RNG、Session、存档格式或内容版本。
- 多格中心、射程天赋、护盾目标范围均复用战斗规则。
- 原占格保持实心，范围图层无指针响应，只在整备且有有效选择时显示。
- 不把寻敌范围当作最终命中区域；非法落点不画圈。

## Review Focus

- 已部署大体型点选自身非锚点不能错误平移；抓取偏移仅拖动时应用。
- 合成后阶数触发光环，消耗源不能被计作覆盖队友；目标位置不得改写。
- 射程天赋只影响攻击/施盾，不能扩大固定狐光环。
- 备战席、未指定位置、桃和扩地令不出现虚假的攻击圈。
- 窄屏SVG对齐棋盘、文字不溢出、开战后消失、图层不挡点击与拖动。

## Task 1: 范围与落点模型

Files: create `src/ui/preparation-range.ts`, `src/ui/preparation-range.test.ts`.

- [x] 实现`preparationRange(preparation, source, hover, dragOffset, maxRank)`，复用`boardDrop`和`placementError`；只读返回当前/试放/合成状态与圆、覆盖伙伴。
- [x] 测试鼠范围对照战斗寻敌，狐范围对照`shieldTarget`、光环对照`attackDamage`；覆盖边界、天赋、移动/合成投影和无效选择。
- [x] 执行`npx.cmd vitest run src/ui/preparation-range.test.ts`。

## Task 2: 画布范围与说明

Files: create `src/render/RangeOverlay.tsx`, `src/ui/preparation-range.css`; modify `src/render/Battlefield.tsx`, `src/main.tsx`.

- [x] 实现SVG圆、虚线光环、中心点与覆盖标记；`clipPath`矩形坐标为24/74/312/312，viewBox为0/0/360/416。
- [x] 仅整备选中时渲染；说明位于battlefield下方，明确寻敌和技能命中区别、狐覆盖计数、桃产钱、非法落点。
- [x] 不修改DOM棋盘交互和已有Phaser实心占格。

## Task 3: 验收与记录

Files: modify `README.md`; create `docs/reviews/2026-10-22-preparation-range.md`.

- [x] 使用simplify与React最佳实践自查；全量测试、构建、Prettier、差异检查。
- [x] 浏览器实操已部署/招募选择、狐范围及覆盖、拖动偏移、取消/开战、320/390宽并保存截图。
- [x] 更新验收与计划，明确三流派平衡未被本轮证明，汇报上一轮提交和本轮未提交的开发结果。
