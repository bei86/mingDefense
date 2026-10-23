# 狐支援覆盖检查实施计划

**Goal:** 玩家能在战前检查核对全队、前排施盾可达和输出光环覆盖及来源。

**Architecture:** 独立纯模型`foxSupport(p: Preparation): FoxSupportModel`按当前已部署位置派生；`FoxSupportCheck`由展开的PreparationCheck挂载，沿用选择回调。复用heroRange/center/distance及配置，自动测试与实际shieldTarget/attackDamage交叉对照。

**Tech Stack:** React、TypeScript、CSS、Vitest；无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-fox-support-design.md`

## 全局约束

用户已授权自主下一步，顺序执行，不派代理。只提交上一轮5d0cb74，本轮新功能留工作区。规则、数值、3格、存档、依赖、命令保持。只读覆盖、一次一目标、不叠加，不宣称胜率或最优。

## Review Focus

1. 施盾包含狐自身及桃；光环只统计输出受益者，两类覆盖不得混淆。
2. 多格按中心距离和最上占格归前排，边界<=，多个狐不能重复累计人数或叠加百分比。
3. 只读已上阵，不把招募或备战狐算成来源；改站位/阶数后不保留过期来源。
4. 查看不修改Session/RNG/资源/撤销；返回整备重新收起，fieldReady禁用选择。
5. 无阵容/无狐/无输出时文案明确，完整占格和多来源在320宽换行，44px操作目标。

## 任务1：纯模型与真实规则对照

Files: 新建`src/ui/fox-support.ts`与`src/ui/fox-support.test.ts`。

- [x] 写测试引用未实现`foxSupport`并确认缺模块失败。测试明确断言`model.units.find(u=>u.id===target.id).shieldSources.some(f=>f.id===source.id)`等于将其他灵兽护盾填满、目标盾置0后真实`shieldTarget`选中目标；逐种八灵验证，包含边界。
- [x] 实现模型字段`foxCount/auraFoxCount/frontRow/frontCount/shieldReachableCount/shieldReachableFrontCount/attackerCount/auraAttackerCount/units`。单位字段`id/kind/rank/position/cells/front/attacker/shieldSources/auraSources`，来源字段`id/rank/position`。复制位置与占格，来源按ID排序、单位按行列ID。
- [x] 测试真实attackDamage移除狐后的增量等于基础伤害×配置光环百分比；覆盖阶数门槛、射程天赋只扩施盾、自施盾、多狐去重/中心距离、空阵无狐、来源过滤及稳定顺序。
- [x] 测试Session保存/资源/RNG/revision/undo保留、模型引用隔离；实际transfer/swap/merge/undo后重新调用模型得到最新覆盖。跑新模型、已有preparation-check/preparation-range/targeting-preview测试。

## 任务2：界面、文档与验收

Files: 新建`src/ui/FoxSupportCheck.tsx`、`src/ui/fox-support.css`；修改`src/ui/PreparationCheck.tsx`与`README.md`；新建`docs/reviews/2026-10-23-fox-support.md`。

- [x] 默认显示三项覆盖摘要；逐兽details默认收起，列完整坐标/来源/空覆盖，选中守卫沿用choose并防重复取消，按钮按fieldReady禁用。PreparationCheck展开才挂载本组件，不存重复派生state。
- [x] 独立作用域CSS，摘要和来源换行，按钮44px；保留原高阶备战提示和原流程。按React最佳实践、simplify检查新代码。
- [x] 启动独立端口，以roster正常操作核对8兽/前排4只/狐来源，点查看保持棋盘/资源，移动及撤销、暂存狐、守阵隐藏。核对390和320宽截图/溢出/按钮尺寸、控制台；生产入口恢复既有进度，禁止注入游戏状态。
- [x] README补操作及限制，记录真实验收；运行全量`npm.cmd test`、`npm.cmd run build`、显式startup-build、Prettier、Git diff检查。完成计划后停自己的服务器并关闭标签，报告提交号和本轮未提交状态。
