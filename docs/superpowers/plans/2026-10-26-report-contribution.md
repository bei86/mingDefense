# 战报贡献占比实施计划

**Goal:** 为两种结算战报显示所选指标全队合计与真实贡献比例，缺失和零态不伪造百分比。

**Architecture:** 纯投影计算分母及比例；共享总计/行内组件接入原表。没有新状态、effect、计时或持久化。

**Tech Stack:** React19、TypeScript、Vitest、Vite、CSS、CUA Edge。

**Spec:** `docs/superpowers/specs/2026-10-26-report-contribution-design.md`

## 全局约束

不修改模拟规则/数值、RNG、schema2/contentv24、3格接敌、存档、导出、收藏、依赖、素材或npm命令。上一轮本地提交，本轮留工作区，不推送；自主顺序开发、自审。

## 审查重点

- 参与分母的是实际参战名单，重伤仍计，备战和无关战报行不计。
- 任一参战成员缺记录时，整表禁算比例，不能用部分合计充当分母。
- 所有0必须显示不计算；零贡献与微小正贡献区分，比例条使用真实未舍入值。
- 同种与逐只同分母，五指标口径独立；失败产钱不充当收入。
- 320宽仍保留四列、44px选择和正常结算操作；切换不改变原状态、导出和存档。

## Task 1：模型与测试

- [x] 新增 `src/ui/report-contribution.test.ts`，先调用 `reportContribution(battle, metric)`与`contributionShare(value, model)`；覆盖五指标、0/缺失/小比例、完整战斗及SSR。
- [x] 运行 `npx.cmd vitest run src/ui/report-contribution.test.ts`确认缺新模块失败。
- [x] 新增 `src/ui/report-contribution.ts`，导出 `ReportContributionModel {total:number|null;missing:number}`、只读分母及 `{percent:number;label:string}|null`比例函数；从battle.allies关联report.units，不写字段。

## Task 2：显示与接入

- [x] 新增 `src/ui/ReportContribution.tsx`：总计提示、缺失/零状态说明、行内百分比与装饰细条；只读受控props，不新增state/effect。
- [x] 修改 `ReportUnits.tsx`两种表接入共享组件；逐只 numerator=reportValue，同种 numerator=group.metrics[metric].value，共用从同一battle计算的分母。
- [x] 修改 `report-units.css`添加本区样式，名称单元格内换行，比例条静态、无新列；缺失和0态无条。
- [x] 新旧战报定向tests、typecheck，按React/simplify自审无多余状态/缓存，缺失不算0。

## Task 3：验证与交付

- [x] 全量test、build、构建后CHECK_STARTUP_BUILD显式检查。
- [x] Edge独立首战双鼠正常部署并完成，核对总计、逐只/同种比例，五指标切换、0态、390/320宽、截图、下一关与console。
- [x] README和 `docs/reviews/2026-10-26-report-contribution.md`记录实际验证与局限；Prettier与Git空白检查，恢复视口、关闭自建页并停止服务。
