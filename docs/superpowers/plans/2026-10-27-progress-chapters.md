# 战役进度分段浏览实施计划

**Goal:** 默认定位当前10关分段，支持全部浏览与敌情往返保留分段。

**Architecture:** App持有可空 `{ chapter: number }`，0全部、1—5分段；campaignChapter统一计算。CampaignProgress受控筛选既有chapters，统计始终为全局。敌情复用原打开/返回路径，焦点context只依赖是否打开。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome/CUA。

**Spec:** `docs/superpowers/specs/2026-10-27-progress-chapters-design.md`

按用户持续授权当前会话顺序实施与自审，不派代理，不自动提交本轮新增开发。

## 全局约束与审查重点

- 不改规则、随机、三格、contentv24/schema2、存档格式、fixture、素材、依赖、npm命令。
- 10/11、40/41边界正确；筛选不改变通关/首领统计或实际当前关。
- 敌情返回保留筛选，完整关闭后重开回当前分段；全部模式不被0的真假值误关。
- 切换select不丢焦点、不重装模态锁；选择其他分段不伪造当前标记。
- 保留隔离/单关提示和暂停/结算原状态；生产可用且无DEV入口。

## Task 1：分段模型、视图和接入

文件：`src/ui/campaign-progress.ts`、`campaign-progress.test.ts`、`CampaignProgress.tsx`、`CampaignProgress.test.tsx`、`campaign-progress.css`、`App.tsx`。

- [x] 先测试campaignChapter在1/10/11/40/41/50的映射；SSR用真实终战开局验证41—50/其他分段/全部模式以及统计独立于筛选。
- [x] 实现 `campaignChapter(stageId: number): number`，只返回 `Math.ceil(stageId / 10)`；模型输出currentChapter。组件新增 `chapter: number`、`onChapter: (chapter: number) => void`，原生选择器0及各组、当前分段按钮、筛选列表；控件44px及窄屏换行。
- [x] App状态改为 `useState<{ chapter: number } | null>(null)`，三个入口 `setProgress({ chapter: campaignChapter(p.stageId) })`，关闭null、切换保存chapter。context使用Boolean(progress)；onIntel仍只设置intel，不重置progress。
- [x] 定向测试、React最佳实践和simplify自审，随后全量测试、build和显式CHECK_STARTUP_BUILD检查。

## Task 2：浏览器与交付

- [x] game-playtest验证正式默认1—10、其他分段/全部/当前、敌情返回保留筛选及完全重开重置，原结算不变。
- [x] 验证隔离终战默认41—50、统计49/50/9首领、开始暂停后分段往返仍暂停；390/320/280布局、控件尺寸/内部滚动/键盘与日志，生产可用无DEV入口，恢复视口/关闭预览并保存截图。
- [x] README及 `docs/reviews/2026-10-27-progress-chapters.md` 更新，Prettier与diff检查，完成计划，新开发留工作区。
