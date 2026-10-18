# 第26–30关实施计划

**Goal:** 扩展至30关，新增远程首领玄羽妖帅。

**Architecture:** JSON配置驱动现有50ms模拟；React HUD与Phaser薄渲染；无新增存档字段。

**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-18-thirty-stages-design.md`。

依已有授权原生执行，不派生代理，不推送；第21–25关已提交14392ed。

## Global Constraints

前25完整配置保持v12；新增数值P；连续每秒一只、180秒、30终点；v2–v12先备份迁移。

## Review Focus

- 远程首领进入射程即停止，仍只攻击当前前排，按阶级/仇恨选择，换排后重新靠近。
- 冻结推迟前摇和技能，半血不重置召唤时钟，上限按父实例计算，清场包含孩子。
- 旧25胜利迁移可继续26，原收益不重领，不重复刷新招募。
- 历史测试按原关卡长度回归，候选只修改slice(25,30)与第六首领，finally恢复。
- 320宽远射/强化召唤可读，DEV检查点不覆盖主档，生产包无入口。

## Task 1: 规则与内容

**Files:** 新增`src/game/thirty-stages.test.ts`、v12快照；修改配置JSON与`content.ts`、历史配置/完成点测试。

- [x] 写前25完整配置、六首领/连续生成、远程距离和前排仇恨/换排、无护甲/免疫斩杀、冻结前摇/技能、半血召唤测试，运行确认新关缺失时失败。
- [x] 配置追加26–30、sixthBoss、版本v13；content.ts追加关名/首领名称与远射情报，复用既有模拟器。
- [x] 历史测试排除新增首领，25完成点改为继续26；新测试覆盖30完成/失败/中止与重复奖励。

## Task 2: 存档与校准

**Files:** `persistence.ts`及测试、`tools/compare-thirty-stages.test.ts`、`tools/export-thirty-stages.test.ts`、`src/game/thirty-stages-simulation.test.ts`、fixtures。

- [x] 加入v12迁移白名单，旧25胜利档先备份、收益不变、推进/刷新仅一次。
- [x] 用72合法路线比较新增五关和首领生命/伤害候选，保留完整样本；仅修改`slice(25,30)`与sixthBoss，finally恢复。
- [x] 导出26/30检查点；旧检查点仅更新版本；模拟测试固定前25结果并检查战报/生命周期/存档及三策略通关。

## Task 3: UI与验收

**Files:** `Battlefield.tsx`、`App.tsx`、`CampaignPanels.tsx`、`useSessionStorage.ts`、`index.html`、README与验收记录。

- [x] 原创羽冠/张弓首领外形，远射与半血HUD，30关终点文案；stage26/stage30 DEV禁写入口。
- [x] `npm.cmd test`、`npm.cmd run build`、Prettier与`git diff --check`，检查生产JS无DEV入口。
- [x] game-playtest验证390/320宽情报/战斗/预警/二阶段/结算和26→27恢复刷新，保留截图；simplify内联复查。
- [x] 更新README、设计最终参数与`docs/reviews/2026-10-18-thirty-stages.md`，记录真实结果与原型限制。
