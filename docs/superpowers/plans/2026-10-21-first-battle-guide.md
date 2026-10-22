# 首战指引实施计划

**Goal:** 提供不阻断自由布阵的首关整备提示。

**Architecture:** 纯函数从当前 Session 推导推荐来源与文案；独立 React 组件负责收起及来源选择，App复用已有choose操作。开发新局入口复用现有禁存档机制。

**Tech Stack:** React 19、TypeScript、Phaser 3、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-21-first-battle-guide-design.md`

本轮在当前会话直接实施。按用户的提交节奏保留未提交改动，不另设审批或创建提交。

## 约束与重点

- 不改v22规则、数值、随机数、存档和npm命令，不添加依赖。
- 不假定固定操作顺序或固定招募ID；推荐必须对应实际存在的来源。
- 合成后撤销、灵兽暂存/遣散、首关存档恢复都重新判断。
- 满阵时不得引导无效部署；非首关/战斗不显示。
- 320像素窄屏无横向溢出；提示不覆盖棋盘。

## 任务1：纯函数与行为测试

- [x] 新增 `src/ui/first-battle-guide.ts`，导出 `firstBattleGuide(session: Session)`，返回提示与可选Source；调用placementError验证部署。
- [x] 新增 `src/ui/first-battle-guide.test.ts`，通过Session.transfer/undo/refresh/restore验证实际流转，不用独立教学计数。
- [x] 运行 `npx.cmd vitest run src/ui/first-battle-guide.test.ts`。

## 任务2：界面与隔离试玩

- [x] 新增 `src/ui/FirstBattleGuide.tsx`；使用原生details/summary实现可收起提示，来源按钮使用已有choose，不执行转移。
- [x] App棋盘上方接入组件；在 `src/ui/style.css` 添加局部样式。
- [x] `useSessionStorage.ts` 添加DEV的 `?playtest=onboarding` 新局入口；测试证明不读取正式存档并返回blocked标记。
- [x] 运行全量Vitest与生产构建，核查生产包排除试玩入口。

## 任务3：实机验收与交付

- [x] Chrome 390×844完成选择、部署、合成、收起/展开与开战；首关实际获胜并进入第2关。
- [x] Chrome 320×780检查窄屏、操作反馈、备战席及撤销；保存截图。
- [x] 按simplify检查新增代码，复核diff，更新README与 `docs/reviews/2026-10-21-first-battle-guide.md`，记录测试结果和边界。
