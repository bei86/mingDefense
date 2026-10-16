# Eight Beasts Implementation Plan

> 本轮由主代理按顺序直接执行。用户已批准本批范围；不分派子代理，不自动提交或修改暂存区。

**Goal:** 猴熊完成六阶培养、技能、天赋、显示和存档接入，使八灵完整可玩。

**Architecture:** 保留独立模拟，新增 `combat-projectiles.ts` 集中射线碰撞和猴熊攻击。`combat-skills.ts` 调用它，`combat.ts` 结算延迟段和易伤；Phaser只读状态。

**Tech Stack:** TypeScript、Phaser3、React19、Vite、Vitest；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-16-eight-beasts-design.md`。

## Global Constraints

- 维持1–5关、50ms逻辑步长、180秒上限、连续出怪。
- 保留逐排、低阶、类型、距离、ID选敌，以及不透明占格和拖动修复。
- 新参数明确P；旧来源值不擅改；旧档备份后迁移，不写用户正常存档做试玩。

## Review Focus

- 零距离瞄准不能产生NaN；首命中应与数组顺序无关。
- 已释放第二段不依赖原施法者/原目标存活；前摇取消仍有效。
- 易伤同帧顺序不能偷偷放大首击或无限叠加，过期应失效。
- 多弹/分裂不能重复造无限事件，实际伤害战报不计过量。
- 扩大商店池后原有脚本优先列表不能将未知种类置顶，旧档必须可迁移。

## Task 1: 八灵内容与回归

Files: `content.ts`, `model.ts`, `progression.ts`, balance JSON, new `monkey-bear.test.ts`.

- [x] 用Vitest复现八灵池、猴熊战斗行为、成长、天赋缺失。
- [x] 扩展heroIds、原创显示名和角色形状，接入熊攻击天赋和猴易伤天赋。
- [x] 更新配置范围，保存v6快照，升级v7。

## Task 2: 猴熊战斗与战报

Files: new `combat-projectiles.ts`, `combat-skills.ts`, `combat-model.ts`, `combat.ts`, `monkey-bear.test.ts`.

Interfaces: `releaseMonkeyAttack(combat, ally, target, damage, packets):void`、`releaseBearAttack(...)`、`releaseLineHit(combat, hit, packets):void`；延迟攻击以area/line区分。

- [x] 射线几何采用前向投影、圆交点排序；零向量向上，距离边界包含。
- [x] 猴贯穿、三阶易伤、五阶100ms双段；熊三射线与单层分裂。
- [x] 伤害结算后施加易伤，重复取最大值并刷新，不覆盖更强效果。
- [x] 运行 `npx.cmd vitest run src/game/monkey-bear.test.ts`；覆盖设计列出的数值和死亡/时序边界。

## Task 3: 集成与显示

Files: `Battlefield.tsx`, `PreparationPanel.tsx`, `App.tsx`, `persistence.ts`, corresponding tests, dev-only roster fixture.

- [x] 原创程序图形猴熊、拳罡/贯穿轨迹及易伤标识；技能说明、八灵文案。
- [x] 测试自然抽取、1–6阶合成、部署/占格回滚、备战无效天赋、存档往返与v6迁移。
- [x] 开发固定阵容显式标记且禁止写档，生产不开放入口。

## Task 4: 验收与记录

Files: `scripts/campaign-simulation.ts`, fixture JSON, README, review report.

- [x] 三种策略加入猴熊，保持全部Session合法命令；重生Boss夹具后 `npm.cmd test`。
- [x] `npm.cmd run build`、Prettier、实际diff与自查；保留真实脚本结果。
- [x] 浏览器验收390/320宽、技能说明、部署、开战/战报及控制台，保存截图。
- [x] 更新当前范围、临时规则和验收记录；标记完成项。
