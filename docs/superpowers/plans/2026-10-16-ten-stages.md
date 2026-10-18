# Ten Stages Implementation Plan

由主代理顺序实施；继续工作的授权已具备，不分派子代理、不自动提交。

**Goal:** 补齐敌人并完成1–10关连续成长。
**Architecture:** content按stage取Boss；combat-skills管理生成/死亡；新增enemy-abilities管理计时召唤，主模拟保留伤害/胜负顺序。Offer增可选rank兼容旧档。
**Tech Stack:** TypeScript/Phaser/React/Vitest，不新增依赖。
**Spec:** `docs/superpowers/specs/2026-10-16-ten-stages-design.md`。

## Global Constraints

- 前五关与八灵数值不变；逐排、连续每秒一只、50ms、180秒。
- 召唤0经验/灵气、分裂碎片2/2；新子怪下步行动，父死亡取消未来事件。
- 内容v8定向迁移v2–v7，检查点失败回滚，开发试玩禁写档。

## Review Focus

- 同步死亡/多包命中不能重复分裂或错误提前胜利。
- 冻结期间召唤不积压爆发，限额按父实例独立。
- 第10关Boss属性和预警不能借用第5关值。
- 新阶级随机数不影响前五关，旧无rank卡保留一阶语义。
- 旧五关完成存档可继续第六关，最高只在第十关完成。

## Task 1: 敌人生命周期与数值入口

Files: content.ts, combat-model.ts, combat-skills.ts, combat.ts, new enemy-abilities.ts / enemies.test.ts, balance JSON/v7 snapshot.
- [x] 写新增敌人、召唤/分裂/冻结/远程/狂暴和Boss隔离测试，先跑失败。
- [x] 扩展EnemyKind与stage Boss配置；出生时钟和独立召唤限额；伤害后分裂与下一步行动。
- [x] 运行 `npx.cmd vitest run src/game/enemies.test.ts`。

## Task 2: 第二轮关卡、招募与存档

Files: session.ts, persistence.ts, content.ts, new ten-stages.test.ts, existing tests, balance JSON.
- [x] 写6–10关连续波次、二阶领取/合成/拒绝、5→6与10终局、v7档迁移/备份/回滚测试。
- [x] 新增五关、二阶招募，旧卡兼容；更新版本与迁移名单。
- [x] 保留五关脚本的目标达成含义，新增十关真实经济模拟并保存检查点与结果。

## Task 3: 界面与验收

Files: App.tsx, CampaignPanels.tsx, PreparationPanel.tsx, Battlefield.tsx, index.html, useSessionStorage.ts, fixtures, README/review.
- [x] 全部十关文案/总数动态化，分辨新敌人、首领名称和敌情；显示二阶卡并使用真实阶级预览合成。
- [x] 加开发验收检查点，明确标记且禁写正常档。
- [x] `npm.cmd test`、`npm.cmd run build`、格式/diff自查；必要时按合法模拟结果校准新增P参数。
- [x] 浏览器390/320宽与新敌人/首领流程，截图、日志；更新文档并如实记录样本和限制。
