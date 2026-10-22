# 失守复盘与布阵建议实施计划

**Goal:** 失败后提供有事实依据且随布阵更新的建议。

**Architecture:** `defeat-advice.ts` 提取轻量复盘事实并推导当前整备建议；独立React组件在结算和整备复用；App只存本次会话复盘摘要。

**Tech Stack:** TypeScript、React 19、Vitest、现有CSS变量，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-defeat-advice-design.md`

本轮自行在当前会话实施，新的开发改动保留待用户下次提交。

## 约束与检查重点

- 不改变v22数值、模拟、存档或现有命令。
- 同时全员重伤与到时按模拟实际全员重伤优先。
- 无逐兽统计时不伪造数据；不以总承伤推测首次阵亡。
- 当前阵容变化后更新建议，满阵/已领取/跨阶/跨种不产生虚假机会。
- 窄屏结算可滚动，重试和返回按钮仍可到达；旧档仍正常恢复。

## 任务

- [x] 新建 `src/ui/defeat-advice.ts`：`defeatRecap(battle)`返回失守摘要或null，`preparationAdvice(preparation, maxRank, recap)`返回最多3条当前建议，部署复用placementError。
- [x] 新建 `src/ui/defeat-advice.test.ts`：真实模拟单鼠失败与超时边界、操作后的建议更新、满阵/合成约束与只读性。
- [x] 新建 `src/ui/DefeatAdvice.tsx`，接入CampaignPanels结算及App整备；选择返回/重试/开战/重开时管理轻量摘要生命周期；添加局部CSS。
- [x] 运行Vitest与生产构建，按simplify复核变更。
- [x] 当前仅Edge可用，使用独立隔离入口真实失败，390/320宽度检查结算、返回后部署/合成及提示更新、重新开战隐藏，并实际胜利进入第2关；保存截图。
- [x] 更新README及验收记录，标明临时UI复盘不持久化与手机真机限制。
