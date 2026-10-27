# 战报收藏筛选实施计划

**Goal:** 按关卡和胜败查找收藏，保留全量备份与原收藏动作。

**Architecture:** 新增reportCollectionView纯派生函数；ReportCollection持有筛选并渲染原生控件，选择仅在可见结果内回退。重读/导入/删除继续走原存储接口，备份始终使用完整库。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Edge与Chrome/CUA。

**Spec:** `docs/superpowers/specs/2026-10-27-collection-filters-design.md`

按持续授权本会话顺序实施与自审，不派代理，不提交本轮新开发。

## 约束和审查重点

- 规则、随机、3格、contentv24/schema2、存档/收藏/备份格式、容量、fixture/素材/依赖/npm命令保持。
- 多条件交集与无匹配不回退到不符合条件的全文；库空与读取失败分开。
- 筛选变化取消删除目标和旧通知；重读/导入保留筛选且选择只在当前结果回退。
- 全量备份不受筛选影响，切换筛选不卸载备份或清空预览。
- 无新增effect/存储写入；44px、短屏内部滚动及焦点循环；正式收藏不作测试删除。

## Task 1：派生与组件

文件：新增 `src/ui/report-collection-view.ts`、`report-collection-view.test.ts`、`ReportCollection.test.tsx`；修改 `ReportCollection.tsx`、`report-collection.css`。

- [x] 先写 `reportCollectionView(entries, filter, selectedId)` 测试，多关胜败、交集、无匹配、输入顺序、所选不匹配时回退及真实收藏增删/备份后的不变性。
- [x] 实现 `ReportCollectionFilter = { stageId: number | null; result: 'all' | 'victory' | 'defeat' }`，只filter+find；返回entries与selected，不改输入或读写存储。
- [x] 组件默认全部，筛选变化setSelectedId(undefined)、setRemoving(null)、setNotice('')；列表和所选来自view。关卡从现有stageNames生成，显示匹配/总数及备份全量说明，库非空无匹配独立提示；重读和导入保留筛选。
- [x] SSR覆盖完整收藏计数、原文、空库和读取失败；定向模型/收藏/备份测试。React/simplify自审，再全量测试、build及显式启动检查。

## Task 2：浏览器与记录

- [x] 正常UI验收关卡/结果交集、选择全文、无匹配清除、重读、备份全量和取消删除，关闭回原状态。隔离与生产入口；390/320/280宽44px及焦点，保存截图；恢复后当前Chrome视口已重置并关闭生产预览，原Edge连接超时后的返回与视口结果无法复核，详见验收记录。
- [x] README和 `docs/reviews/2026-10-27-collection-filters.md`，Prettier/diff检查、完成计划。本轮留工作区、不推送。
