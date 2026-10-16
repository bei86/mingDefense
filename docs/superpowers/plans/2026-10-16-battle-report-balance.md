# Battle Report and Five-stage Balance Implementation Plan

**Goal:** 提供可核对的逐兽战报，依据正常经济多种子样本调整临时Boss压力。

**Architecture:** 模拟器记录数值，React仅展示；伤害包和剑阵携带来源实例ID。统计为可选的版本化增量，旧战报保持缺失。v2到v3提供明确、可备份的存档迁移。

**Tech Stack:** TypeScript、React、Phaser、Vitest、Vite，沿用已有依赖。

**Spec:** ../specs/2026-10-16-battle-report-balance-design.md

用户已授权执行；本会话直接实施并自行复核，不另设确认关卡。不提交、不重排用户暂存内容。

## Global Constraints

- 六灵兽、五关、180秒、50ms固定步长、1/2倍速、正常经济与关后免费招募。
- 只调整P数值，保留v2快照；无账号、云存档、关卡扩展或新增美术依赖。

## Review Focus

- 同tick多个伤害包避免过量重复计数，双方同归仍判负。
- 死后延迟伤害、双鹰剑阵按实例归属。
- 满盾重复施放不虚增护盾，承伤只计生命损失。
- 旧胜利档无统计可继续；损坏的新统计不可被接受。
- 迁移备份/写入失败不覆盖原档，重试与跨关清零统计。

## Tasks

- [x] 在combat-model/combat-skills/combat中添加来源与report；用battle-report.test.ts覆盖上述统计边界，保留既有1/2倍速确定性回归。
- [x] 拆出scripts/campaign-simulation.ts供原样本与多种子候选比较共用；记录基线、候选、聚灵/不聚灵，不为通过断言注入资源。
- [x] 保存v2快照，确定Boss参数和v3版本；更新persistence迁移与report校验，重生正常经济Boss检查点。
- [x] 新建BattleReport.tsx并接入胜负结算；增加紧凑、可展开的逐兽数据与统计口径说明，检查320/390px布局和主操作可达。
- [x] 运行npm.cmd test、npm.cmd run build、定向Prettier、git diff --check；game-playtest浏览器验证并保存截图，更新README、参数说明与验收报告。

验收结果：65项测试通过，构建通过；四组共288次五关模拟，选定组72次均通关；浏览器胜负战报、免费重试和320/390px布局通过。完整证据及样本局限见 `../../reviews/2026-10-16-battle-report-balance-playtest.md`。
