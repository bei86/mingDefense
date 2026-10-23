# 同种高阶备战提示实施计划

**Goal:** 战前检查可核对同种更高阶备战与合法低阶上阵目标，沿用手动换位。

**Architecture:** 独立纯模型reserve-upgrades计算来源/目标/完整占格，轻量summary与展开后的ReserveUpgrades共用一次计算；原PreparationCheck统计维持按展开计算，不改Session或战斗。派生结果不存React state。

**Tech Stack:** React、TypeScript、现有CSS、Vitest，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-reserve-upgrade-hint-design.md`

## 全局约束

用户已批准下一步，顺序实施，不派子代理。已提交4fa078f，新功能留工作区。规则/数值/存档/启动命令/依赖不变。提示只选择、手动换位；不自动应用，不称必胜或最优。

## Review Focus

1. 只按已领取备战与同种低阶上阵配对，不把招募算成拥有。
2. 多格完整占格与swapError一致，满备战不误禁用，不能切开占位。
3. 每次派生反映换位/合成/撤销，没有过期目标；多个备战共用目标需明确一次一对。
4. 查看/选择不改变Session、RNG、资源或撤销，fieldReady为假按钮禁用。
5. 收起摘要按来源只数而非目标数；长目标/完整占格在320宽能阅读与操作，战斗隐藏。

## 任务1：只读模型

- [x] 新`src/ui/reserve-upgrades.test.ts`，先引用未实现函数确认失败；用八灵fixture验证可换目标等于真实swap接受，输入不变、引用隔离、满备战合法、来源与目标排序、同种严格低阶/未领取排除、换位与撤销重算。
- [x] 新`src/ui/reserve-upgrades.ts`导出`reserveUpgrades(p: Preparation): ReserveUpgrade[]`，返回`{reserve:{id,kind,rank},targets:{id,rank,position,cells}[]}`。用swapError筛选，复制位置与占格；无候选返回空。
- [x] 跑定向测试并检查旧preparation-check、formation-swap。

## 任务2：界面、文档与验收

- [x] 新`src/ui/ReserveUpgrades.tsx`，使用现有ArtImage；每来源可选中，details默认收起目标，各目标可选中并展示完整坐标。choose只在尚未选中时调用，按钮fieldReady禁用。
- [x] 改`src/ui/PreparationCheck.tsx`只算一次reserveUpgrades；summary有候选显示N只；展开插入提示，条件Boolean避免渲染0。只更新该模块CSS保证44px目标和窄屏换行，不引入全局选择器。
- [x] README补功能与操作说明，按React最佳实践和simplify自查：派生状态不加effect/memo，组件不内联定义，不引测试模拟模块。
- [x] 定向及全量测试、build、startup-build、Prettier/diff空白；启动独立本地开发端口，以真实UI操作roster隔离试玩，验证选中/换位/撤销与战斗隐藏、390/320布局截图和控制台。检查生产包正常打开与既有正式进度保持，不注入正式存档。
- [x] 记录实际验收与限制，勾计划，停止自建服务器/关闭自建标签，报告4fa078f提交和本轮未提交新功能。

关键断言：`expect(reserveUpgrades(s.preparation)[0].targets.map(t=>t.id)).toEqual(expectedIds)`；`expect(s.swap(source,target)).toBeNull(); expect(reserveUpgrades(s.preparation)).toEqual([]); s.undo()`应恢复提示；同一来源多个目标只算一条提示，点击任意按钮仍由既有choose选中。
