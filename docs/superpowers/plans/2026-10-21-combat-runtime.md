# 战斗模拟独立调度 Implementation Plan

**Goal:** 将战斗模拟从视觉刷新调度中独立出来，验证实战时间与暂停行为。

**Architecture:** src/ui/game-loop.ts使用25ms计时器调用现有GameClock.advance(performance.now())，HUD最多10次/秒。App挂载启用、清理时停止；Phaser视觉循环不变。

**Tech Stack:** React / TypeScript / Phaser / Vitest / Vite。

**Spec:** docs/superpowers/specs/2026-10-21-combat-runtime-design.md

## 约束与复查重点

保持3格、全部战斗/经济参数、v17存档和250ms长停顿保护；不自动提交。检查没有RAF时的时间比率、暂停及天赋停表、长停顿恢复、重复挂载清理、开发/生产浏览器运行。

## 实施步骤

- [x] 新建src/ui/game-loop.test.ts，用真实Session与GameClock、Vitest假时钟验证上述边界；测试不依赖RAF，不注入战斗结果。
- [x] 新建src/ui/game-loop.ts并替换App内RAF驱动，清理时clearInterval；移除临时诊断日志。
- [x] 运行定向回归，再运行npm test -- --maxWorkers=2及npm run build，检查当前配置不变与生产包不含临时探针。
- [x] Chrome独立禁写存档场景验证运行时间、出怪、暂停继续和320/390布局，截图并记录浏览器实际限制。
- [x] simplify内联自审，更新README与验收报告，格式及git diff检查。
