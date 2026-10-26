# 第8关隔离试玩实施计划

**Goal:** 让玩家从同一合法开局重复比较原方案和第8关远程减少方案。

**Architecture:** 显式工具生成三份档，DEV专用Session子类只替换实例spawns，loader返回隔离信息；复用游戏UI、时钟、战报及存储隔离，紧凑控件导航重置。

**Tech Stack:** TypeScript、React、Vitest、Vite、浏览器截图。

**Spec:** `docs/superpowers/specs/2026-10-26-ranged-playtest-design.md`

## 约束与审查重点

- 不改正式数值、schema2/contentv24、3格接敌、仇恨/结算/出怪算法、依赖、npm命令或黄金检查点；本轮不提交不推送。
- 三案例与两方案固定；未知case/variant回退获益案例/原方案；保存公开状态与随机数，返回布阵后再开战不能丢候选。
- 配置覆盖只在同步生成表期间存在，正常/异常恢复；局部Session start失败不替换或推进状态。
- 正式存档在loader之前隔离，导入恢复不可绕过；结果不能推进下一关，重置回原案例。
- 敌情手册读选中调度；正常关卡与正常结果动作保持；DEV代码不进入生产包。
- 顺序实现、自审，不因技能审查门槛重复请求许可。使用brainstorming、writing-plans、game-playtest、React最佳实践和simplify。

## Task 1：固定合法档与开发Session

- [x] 新增`tools/export-ranged-playtest.test.ts`，默认skip；显式EXPORT_RANGED_PLAYTEST=1，从三条正常经济路线导出第8关开战档至`src/game/fixtures/ranged8-*-checkpoint.json`，保存来源信息，实际执行。
- [x] 写`src/game/fixtures/ranged-playtest.test.ts`先确认缺模块失败；实现`ranged-playtest.ts`，类型、参数解析、URL、独立Session、完整调度与reset/retry/nextStage限制。
- [x] 三档逐字段匹配合法路线，两方案实际回放等于前轮候选作用域，调度/配置/输入与失败重入覆盖；运行定向测试。

## Task 2：接入与界面

- [x] loader增加DEV ranged8分支，导出浏览器Boot类型含可选试玩信息；测试默认与非法参数、禁读写正式存储，其他入口保持。
- [x] 新增紧凑`RangedPlaytest.tsx`控件与样式，案例选择/方案链接/重置导航；App仅DEV显示，在结果动作复用，不新增游戏循环订阅。
- [x] ResultModal增加可选单关动作内容与说明，隐藏普通下一关/重试/重开挑战；普通结果行为保持。
- [x] stageIntel/StageIntel可选调度，仅当前关使用真实候选表；测试真实出怪数量/时间与普通入口不变。
- [x] 定向测试及TypeScript通过，按React与simplify自审。

## Task 3：验收与交付

- [x] 启动开发服务器，按game-playtest实际验收导航重置、选择/开战/暂停返回/天赋/结算切换、窄屏和画布，保留截图证据，核对正式战役数据不变。
- [x] 全量测试、生产构建、显式startup-build；检查生产排除新入口与fixtures，普通生产页带试玩参数仍正常启动。
- [x] README添加链接/重置口径和限制，验收文档记录实测结果、测试数、浏览器证据、生产排除和真机边界；格式/空白检查，勾选完成并汇报。

验收证据与实际边界：`docs/reviews/2026-10-26-ranged-playtest.md`。正式存储隔离通过加载桩、禁写路径和浏览器隔离入口核对，未提取浏览器正式档作全文前后对比。
