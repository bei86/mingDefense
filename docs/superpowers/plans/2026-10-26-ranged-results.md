# 第8关试玩战果对照实施计划

**Goal:** 让玩家切换方案后比较最近真实战果并复制反馈。

**Architecture:** DEV Session记录成功开战档；纯快照/存储/导出模块维护6槽位sessionStorage；独立React组件在结算后保存，复用ReportText。当前授权自主顺序执行、自审，不派代理，不重复审批。

**Tech Stack:** TypeScript、React、Vitest、Vite、浏览器截图。

**Spec:** `docs/superpowers/specs/2026-10-26-ranged-results-design.md`

## 全局约束与审查重点

- 只提交前轮987724f；本轮新增不提交、不推送。正式contentv24/schema2/三格/规则/素材/依赖/命令不改。
- 未完成/未选完天赋/未结算不得记录；重复渲染不得重复写；中断不能覆盖上次完整战果。
- 错误、旧版本、重复/超额槽位、NaN/Infinity/负数、损坏开战档均不得当作可比数据；失败保留原存储，当前快照仍能导出。
- 同档/同最终天赋/同聚灵时长不等于同操作；单边不伪造差值，记录时间为捕获时间。
- 清空仅删除开发key，存储拒绝不阻止游戏；生产JS排除所有新入口标识。弹窗Tab覆盖summary与链接。

## Task 1：快照、存储和导出

文件：修改`src/game/fixtures/ranged-playtest.ts`；新建`src/ui/ranged-results.ts`和`src/ui/ranged-results.test.ts`。

- [x] 先写缺模块失败测试：真实两方案快照、准备/进行中/待选天赋拒绝；`rangedResult(trial, now)`返回只读独立数据，不改变游戏。
- [x] DEV Session增加成功开战档快照，reset清空；验证返回布阵/重试后更新到实际开战档。
- [x] 实现`readRangedResults(storage)`、`saveRangedResult(storage, result)`、`clearRangedResults(storage)`；独立key/version/contentVersion，512KiB/6槽位，最近替换不串案例，异常保留底层数据。
- [x] 实现`rangedComparison(entries, caseId)`和`rangedResultsDocument(entries, caseId)`，完整开局、最终天赋及聚灵事实对照，单边明确未试玩。测试覆盖坏版本、非有限数值、重复槽位、超大/坏JSON、拒读写/清空及导出准确性。

## Task 2：界面接入

文件：新建`src/ui/RangedResults.tsx`、`src/ui/ranged-results.css`；修改`RangedPlaytest.tsx`、`App.tsx`、`useModalFocus.ts`及`ranged-playtest.test.tsx`。

- [x] 以当前trial为输入，lazy读取，终局effect按战斗引用幂等保存，失败可重试、当前页可导出；不在模拟循环读写。
- [x] 折叠面板、两列指标、时间/比较说明、清空、ReportText复制/下载；顶部和结果只挂一个面板，导航仍恢复同档且保留记录。
- [x] 焦点列表纳入summary和a[href]；SSR验证空记录、单边、双边和对照差异，普通流程不受影响。
- [x] 按React最佳实践与simplify自审；定向测试、TypeScript通过。

## Task 3：运行验收与交付

- [x] 浏览器真实完成两方案，跨刷新和案例保留对照，报告复制提示/文本/实际下载、清空和键盘操作（系统剪贴板回读未证实，详见验收文档），桌面/390/320截图；日志和误差口径明确，不称真机验收。
- [x] 全量测试、build及显式startup-build；生产不含新key/标签。格式/空白检查。
- [x] README、验收文档记录证据与限制，勾选完成；汇报中文提交号、试玩链接、测试数，新开发留工作区。
