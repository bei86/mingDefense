# 逐兽战报多维排序实施计划

**Goal:** 在既有结算逐兽表切换五种贡献排序，保留原始数据与窄屏布局。

**Architecture:** 只读排序函数加独立逐兽表组件，局部state保存指标，不新增effect或持久化。

**Tech Stack:** React 19、TypeScript、Vitest、Vite、既有CSS变量。

**Spec:** `docs/superpowers/specs/2026-10-26-report-sorting-design.md`

## Global Constraints

不修改模拟/数值、RNG、schema2/contentv24、3格接敌、依赖、素材或原npm命令。只本地提交上一轮，本轮留工作区。

## Review Focus

- 同名/同阶依实例编号区分，同值固定编号顺序。
- 旧记录缺失护盾指标不得冒充0，零值必须在缺失之前。
- 五次排序不改变战报数组、导出文本、存档及结算资源。
- 施盾和吸收分列说明，失败产钱不当作入账。
- 320宽仍能操作选择并阅读四列表，收起后重开保持选择。

### Task 1: 只读排序与逐兽表

- [x] 新建 `src/ui/report-unit-sort.test.ts`：五项指标独立数据、0/缺失/同值、真实完成战斗的只读性与SSR各模式。
- [x] 运行 `npx.cmd vitest run src/ui/report-unit-sort.test.ts`，确认新模块缺失的失败。
- [x] 新建 `src/ui/report-unit-sort.ts`，导出 `reportMetrics`、`ReportMetric`、`reportValue(entry, metric): number | null`、`sortReportUnits(entries, metric): UnitBattleStats[]`。排序复制数组、已记录降序、缺失最后、编号升序。
- [x] 新建 `src/ui/ReportUnits.tsx`、`src/ui/report-units.css`，导出受控 `ReportUnitTable`和局部state的 `ReportUnits`，从 `BattleReport.tsx`迁移原表并加入原生排序选择和指标caption。各列及施盾/吸收数值均用未记录回退。
- [x] 定向测试与TypeScript验证，再按React和simplify自审局部状态、组件边界和排序只读性。

### Task 2: 验收与记录

- [x] 全量 `npm.cmd test`、`npm.cmd run build`，构建后显式 `CHECK_STARTUP_BUILD=1` startup-build检查。
- [x] 独立开发试玩正常完成一关，依次操作五种排序、折叠和结算入口；390/320宽截图与尺寸，读控制台。
- [x] 更新README及 `docs/reviews/2026-10-26-report-sorting.md`，记录实际证据与局限，格式化和Git空白检查，清理自己的服务与浏览器页。
