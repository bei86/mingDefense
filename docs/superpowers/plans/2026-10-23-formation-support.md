# 阵型预设狐支援覆盖对照实施计划

**Goal:** 应用阵型前核对狐支援覆盖与来源变化。

**Architecture:** `formationSupport(preparation, plan)` 重用 `foxSupport`，按计划实例编号对照；独立折叠组件接入现有预设弹窗。原应用命令不变。

**Tech Stack:** React 19、TypeScript、Vitest、Vite，原依赖不变。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-support-design.md`

## 约束与执行

本会话顺序实现与自查，不委派。此前功能已提交9ffad68，本步完成后保留未提交供下次提交。不改存档、规则、随机、三格接敌距离或启动命令。

## 重点审查

- 覆盖总数相同仍须列出接受者和来源变化。
- 同种同阶依真实计划ID映射，不依数组索引或重新配对。
- 备战与空场不伪造0格位置或前排行。
- 多格完整占格、来源坐标使用1基且窄屏可换行。
- 切换空槽隐藏、返回槽收起，应用和撤销保持已有行为。

## Task 1: 只读模型

- [x] 新增 `src/ui/formation-support.test.ts`，先运行确认缺模块失败。
- [x] 新增 `src/ui/formation-support.ts`，输入Preparation与FormationPlan|null；无有效计划返回null。返回before/after覆盖模型及按ID排序的changes，变化含before/after可空覆盖项。
- [x] 测试真实Session.applyFormation/undo前后模型一致；总数相同但来源/接受者变化；实际计划ID映射；备战进出、多格、空场、无狐无输出、无效计划、数据不变和深层坐标隔离。
- [x] 运行 `npx.cmd vitest run src/ui/formation-support.test.ts src/ui/fox-support.test.ts src/ui/formation-targeting.test.ts`。

## Task 2: 预设界面

- [x] 从 `FoxSupportCheck.tsx` 提取来源格式到 `fox-support-text.ts`，旧入口复用。
- [x] 新增 `FormationSupport.tsx` 和 `formation-support.css`：默认收起、展开才算模型；三项人数表、前排和来源狐数量；逐兽变化嵌套折叠，双方完整占格与来源；明确静态覆盖含义。
- [x] `FormationPresets.tsx` 在受击目标对照后接入，key包含槽位。
- [x] 浏览器试玩保存原阵，移动狐，再开原预设核对5/8→3/8、前排1/1→2/4、光环3/6→2/6；切空槽和返回；应用后撤销恢复；390px/320px截图、溢出及操作可达性检查。

## Task 3: 交付验证

- [x] 运行全量测试、build、启用CHECK_STARTUP_BUILD的startup-build测试、Prettier与diff检查。
- [x] 启动生产预览验证加载和新入口；不改正式战役数据。
- [x] 按simplify检查新代码重复、状态与计算边界；更新README和review，记录实际证据及限制。
- [x] 停止本次服务器、关闭本次标签并恢复视口。报告上次提交与本次未提交功能。
