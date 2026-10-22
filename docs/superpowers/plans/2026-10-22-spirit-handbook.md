# 灵兽图鉴实施计划

**Goal:** 在整备及暂停状态提供八灵基础属性、占格和分阶技能参考。

**Architecture:** 纯函数 `spiritHandbookEntry(kind, rank)` 从content提供基础展示数据与技能文案。独立 `SpiritHandbook` 组件管理浏览选择，App接入现有模态与暂停流程。

**Tech Stack:** React 19、TypeScript、Phaser现有素材、Vitest，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-spirit-handbook-design.md`

本轮在当前会话实施，新工作保留未提交，按用户下次指令提交。

## 约束与重点

- 使用当前配置，保持v22数值/存档/随机数与已有操作。
- 说明基础值不包含本轮加成，不把伤害与DPS混用。
- 桃/狐专门文案；按三/五阶阈值展示技能，不伪造解锁。
- 不丢失整备选择；战斗查看图鉴保持暂停，关闭后仍需继续守卫。
- 320像素窄屏无横向溢出，模态焦点与关闭可到达。

## 任务

- [x] 新建 `src/ui/spirit-handbook.ts` 和行为测试，从content读取8灵6阶数据，核对技能与模拟分支，覆盖产钱/护盾/易伤/形状及只读性。
- [x] 新建 `src/ui/SpiritHandbook.tsx`，角色选择/阶数选择/占格/属性/技能；接入App和PauseMenu，添加局部CSS。
- [x] 使用现有隔离onboarding入口，在390/320宽度实际检查整备选择保留、暂停查看与继续；保存截图。
- [x] 全量Vitest、构建、格式及diff复核，按simplify检查新增代码，更新README与验收记录。

结果与边界见 `docs/reviews/2026-10-22-spirit-handbook.md`。
