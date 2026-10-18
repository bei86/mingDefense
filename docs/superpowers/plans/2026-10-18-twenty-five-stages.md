# 第21–25关实施计划

**Goal:** 扩展至25关，新增配置组合首领岩咒督军。

**Architecture:** 独立50ms模拟、JSON配置、React HUD、Phaser渲染；复用所有战斗和存档字段。

**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-18-twenty-five-stages-design.md`。

本轮按已有授权原生执行，不派生代理、不推送；16–20已独立提交72938cd。

## Global Constraints

前20关/八灵/经济/天赋保持v11；新增参数P；每秒一只、180秒、25终点；v2–v11先备份迁移。

## Review Focus

- 护甲与易伤组合不影响斩杀免疫及伤害统计；冻结推迟召唤和横扫。
- 半血恰逢到期时只召本次，非到期时不改变时钟；上限按父实例计算。
- 旧20胜利迁移后原收益不重领，进入21只免费刷新一次。
- 历史快照和模拟测试按原长度验证，候选工具不得越界改动其他关。
- 320宽同时显示护甲/召唤，开发入口禁写正式档，生产构建剔除检查点。

## Task 1: 内容和首领组合

**Files:** 新建`src/game/twenty-five-stages.test.ts`、v11快照；修改配置JSON、`content.ts`及既有测试。

- [x] 先新增前20完整快照不变、连续出怪、五首领选择和联合规则测试，运行确认扩关测试失败。
- [x] JSON追加21–25与fifthBoss，版本v12；content.ts追加名称与首领查找，复用现有伤害/召唤规则。
- [x] 旧测试排除新增首领、按历史关卡前缀回归；20终点测试改为继续21，25终点测试覆盖重复奖励/失败/中止。

## Task 2: 迁移与经济校准

**Files:** `persistence.ts`、`persistence.test.ts`、`tools/export-twenty-five-stages.test.ts`、`tools/compare-twenty-five-stages.test.ts`、`src/game/twenty-five-stages-simulation.test.ts`、fixtures。

- [x] 迁移白名单加入`prototype-2026-10-18-v11`，旧20完成档备份后进入21且不重复消耗/领奖。
- [x] 比较仅修改`config.stages.slice(20,25)`与fifthBoss，在finally恢复；72路线保留每关胜利/时长/生命和各策略结果。
- [x] 导出21/25合法检查点，旧fixtures仅更新版本；模拟测试校验前20结果、全部存档和战报合计/生命周期。

## Task 3: 展示与验收

**Files:** `Battlefield.tsx`、`App.tsx`、`CampaignPanels.tsx`、`useSessionStorage.ts`、`index.html`、README与验收记录。

- [x] 展示25关终点与第五首领，联合HUD、原创岩铠长戟外形；DEV增加stage21/stage25禁写入口。
- [x] `npm.cmd test`、`npm.cmd run build`、Prettier和`git diff --check`，查生产JS无DEV标记。
- [x] game-playtest验收390/320宽情报/预警/二阶段/结算及21→22恢复刷新；simplify内联复查，不改无关系统。
- [x] README与`docs/reviews/2026-10-18-twenty-five-stages.md`写入真实结果、边界和截图。
