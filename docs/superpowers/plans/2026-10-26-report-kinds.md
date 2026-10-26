# 同种灵兽战报汇总实施计划

**Goal:** 结算逐只/同种切换，沿用五指标排序，准确标注记录不完整。

**Architecture:** 新增只读reportKindSummary投影；既有ReportUnits管理模式和共享排序，拆出轻量选择与表头避免复制，不改战斗及持久化。

**Tech Stack:** React19、TypeScript、Vitest、Vite、既有CSS变量、CUA Edge。

**Spec:** `docs/superpowers/specs/2026-10-26-report-kinds-design.md`

## 全局约束

不修改模拟规则/数值、RNG、schema2/contentv24、3格接敌、存档、导出、收藏、依赖、素材或原npm命令。上一轮本地提交，本轮留工作区，不推送。自主顺序实施与自审。

## 审查重点

- 同种不同阶累加，已重伤仍计，备战不计；关联以战斗实例为准。
- 任意成员缺指标，合计不可假装完整0；全部缺失与部分缺失区分。
- 五种指标合计守恒；完整0排在缺失前；相同值固定八灵顺序。
- 切换模式共享排序，逐只编号和站位不能丢，收起重开保留。
- 320宽四列表与两个44px原生选择可用，下一关仍正常结算刷新。

## Task 1：只读聚合与测试

- [x] 新增 `src/ui/report-kinds.test.ts`，调用 `reportKindSummary(battle, metric)`；不同阶、重伤、备战、缺整行/缺单项、0与空态、只读、五项守恒及真实战斗保存/导出对照。
- [x] 运行 `npx.cmd vitest run src/ui/report-kinds.test.ts`，确认缺新模块的预期失败。
- [x] 新增 `src/ui/report-kinds.ts`：导出 `ReportKind`（kind、count、fallen、ranks、metrics），`reportKindSummary` 返回排序后的各组或null，完整项降序、缺失后置、同值八灵顺序。metrics各项 `{value:number|null,recorded:number}`。

## Task 2：界面接入与回归

- [x] 修改 `ReportUnits.tsx`增加原生模式选择，模式类型 `'unit' | 'kind'`；原逐只表与新受控 `ReportKindTable`共用排序选择及表头，父级共享metric，新增局部mode。
- [x] 同种表显示只数、重伤、阶数分布及五项合计，缺失按记录人数说明，caption和注释标明合计口径；原 `report-units.css`补充布局，保持44px选择、四列和自动换行。
- [x] SSR核对合计、缺失、五项排序caption；运行新旧排序/战报导出测试及typecheck，按React/simplify自审，避免新增effect和额外持久化。

## Task 3：验收与交付

- [x] 全量test、build，构建后CHECK_STARTUP_BUILD显式检查。
- [x] Edge独立新局合法布两只同种灵兽，完成一关，对照逐只与同种总和，切换排序/模式、键盘收起重开、下一关；390/320宽截图、尺寸与console。
- [x] README与 `docs/reviews/2026-10-26-report-kinds.md`记录实际结果及局限；Prettier、Git空白检查，恢复视口并关闭自建页/服务。
