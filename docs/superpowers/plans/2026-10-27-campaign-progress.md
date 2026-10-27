# 战役进度实施计划

**Goal:** 在整备、暂停及结算提供50关本轮进度与敌情预览。

**Architecture:** campaignProgress纯函数从Session和现有关卡配置派生统计；CampaignProgress只渲染并回调stageId。App管理进度可见和intel:number|null，StageIntel复用当前实战信息并允许独立初始预览关卡。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome/CUA。

**Spec:** `docs/superpowers/specs/2026-10-27-campaign-progress-design.md`

按持续授权当前会话顺序执行、自审，不派代理，不自动提交本轮新开发。

## 约束与审查重点

- 只读，不写存档，不改规则/随机/三格/contentv24/schema2、fixture、素材、依赖和npm命令。
- 通关只计rewardedStages中的有效关卡并去重，当前胜利也标当前；稀疏旧记录不补造。
- DEV隔离只呈现当前检查点，不能当正式成绩；生产可用且原DEV入口继续排除。
- 预览关卡与currentStageId分开，试玩spawns只用于真实当前关，不允许跳关。
- 暂停不恢复，结算不领奖；弹窗互斥、44px、短屏滚动和焦点循环。

## Task 1：只读模型与视图

文件：新增 `src/ui/campaign-progress.ts`、`campaign-progress.test.ts`、`CampaignProgress.tsx`、`CampaignProgress.test.tsx`、`campaign-progress.css`。

- [x] 测试新局50关/10首领、有效通关去重与过去未记录/未来未到达，真实胜败回整备/重试状态，真实终战完成以及调用前后save一致。
- [x] 实现 `campaignProgress(session:Session)`，输出entries/chapters/current/currentState/cleared/bossesCleared/total/bossesTotal。按配置生成，模型不调用Session动作。
- [x] 实现带来源提示的只读弹窗，所有关卡按钮回调onIntel(id)，当前aria-current=step，标首领，底部收起。5列min44px、按钮min64px及内部滚动。
- [x] SSR验证50个入口/10首领、当前/隔离说明、首控件和无渲染动作，运行定向验证。

## Task 2：接入与敌情往返

文件：`App.tsx`、`CombatPanels.tsx`、`CampaignPanels.tsx`、`StageIntel.tsx`、新 `StageIntel.test.tsx` 及既有 `ranged-playtest.test.tsx`。

- [x] App增加progress state和模态context，intel从boolean改为number|null，原打开传当前关；进度打开敌情传点击关，隐藏进度；关闭敌情回进度。
- [x] StageIntel新增initialStageId/closeLabel可选参数，currentStageId保留实际关卡；SSR验证当前试玩出怪不泄漏到其他预览关，默认调用保持原行为。
- [x] 整备、暂停、结算提供入口，PauseMenu互斥与结果旧动作保留；更新真实胜败SSR断言。
- [x] 全量测试、build、显式startup-build及React最佳实践/simplify自审。

## Task 3：浏览器和文档

- [x] game-playtest检查正式胜利进度、查看未来首领敌情并返回、隔离后期/暂停、390/320/短屏和焦点、生产入口及日志，保存截图并恢复视口。
- [x] README/验收记录，变更源码Prettier、diff检查及计划完成；新开发留工作区。
