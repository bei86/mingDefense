# 第31–35关实施计划

**Goal:** 扩展至35关，加入近战护甲首领赤角战魁与旧30关存档续关。

**Architecture:** JSON驱动既有50ms模拟器，React负责情报与操作，Phaser只负责战场展示。无新增依赖或存档字段。

**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3。

**Spec:** `docs/superpowers/specs/2026-10-21-thirty-five-stages-design.md`。

本轮按用户继续开发授权在当前工作区执行，保留改动供试玩；不自动提交或推送。

## Global Constraints

前30关完整配置保持v13；新增数值P；每秒连续出怪、180秒、35关终点；v2–v13先备份迁移；新首领使用程序轮廓。

## Review Focus

- 近战先走到0.8格再攻击，先清前排，冻结不能提前释放横扫。
- 护甲与易伤乘算；首领免疫鼠斩杀；半血不重置召唤时钟，孩子按父实例计上限。
- 旧30胜利继续31，不重领奖或重复刷新；备份/写入失败保留原档。
- 历史配置和72路线前30结果完整保留；比较工具只改slice(30,35)与seventhBoss并finally恢复。
- 320宽情报及新首领状态可读；DEV入口不读写主档，生产包排除检查点和模拟工具。

## Task 1：配置、规则与迁移

**Files:** 配置JSON、v13快照、`content.ts`、`persistence.ts`、新`thirty-five-stages.test.ts`及历史关卡测试。

- [x] 保存v13配置快照，追加31–35与seventhBoss、v14版本；content添加名称与首领映射。
- [x] 用`expect({...old, stages: old.stages.slice(0,30), scope: v13.scope, contentVersion: v13.contentVersion, status: v13.status}).toEqual(v13)`验证全部旧配置。
- [x] `createCombat(...,{stageId:35})`验证接近/换排、护甲、冻结、半血召唤/上限和清场；`won(35)`验证终点恢复/重试。
- [x] `loadSession`加入v13白名单，用旧30胜利档验证备份、31入口、一次免费刷新和写入失败原档保留。
- [x] 历史测试只检查原有关卡前缀；旧30终点改为可继续31；既有检查点仅更新内容版本。

## Task 2：合法路线与检查点

**Files:** `tools/compare-thirty-five-stages.test.ts`、`tools/export-thirty-five-stages.test.ts`、`src/game/thirty-five-stages-simulation.test.ts`、31/35 fixtures。

- [x] 复用`simulate(seed, policy, boost, 35, true)`，12种子×3策略×聚灵开关生成72路线。
- [x] 比较新增参数候选，保留完整样本；固定前30胜利数量，检查三策略都有完整35路线。
- [x] 导出首条合法完整路线的`checkpoints[30]`和`checkpoints[34]`；验证`validSave`、战报和生命周期一致。

## Task 3：展示与验收

**Files:** `Battlefield.tsx`、`App.tsx`、`CampaignPanels.tsx`、`useSessionStorage.ts`、`index.html`、README、素材待办和验收文档。

- [x] 画赤角/铜甲/双锤轮廓；更新35关终点文案与首领机制介绍，添加stage31/stage35禁写DEV入口。
- [x] 将新增两张首领图需求单列为扩展，不更改原58项/18缺项的统计。
- [x] 运行`npm.cmd test`、`npm.cmd run build`、针对改动的Prettier、`git diff --check`及生产JS的DEV标记排除检查。
- [x] 用game-playtest检查390/320宽情报、战斗与操作并截图；记录实际完成的流程及限制。
- [x] simplify复查最终差异，更新README与验收结果，不声称脚本路线等于玩家通关率。

浏览器检查已覆盖情报、开战、倍速与暂停/继续；受既有慢帧现象影响，完整二阶段与结算尚未手动复验。具体证据及限制见 `docs/reviews/2026-10-21-thirty-five-stages.md`。
