# 第28–30关校准实施计划

**Goal:** 诊断并修复当前三格规则28–30关难度断点，让控制/经济各有合法30关完成路线，包含不聚灵路线。

**Architecture:** 局部P配置校准，固定模拟器和购买/天赋策略保留；诊断与候选工具输出独立证据。当前回归和历史黄金分开，v19备份迁移，DEV检查点隔离正式存档。

**Tech Stack:** TypeScript / React / Phaser / Vitest / Vite。

**Spec:** docs/superpowers/specs/2026-10-21-stage30-calibration-design.md

**执行方式：** 按用户已授权的下一步，由当前会话直接完成，不委派代理，不自动提交本轮新开发。

## 全局约束与检查重点

- 前27关与31–40配置保留；仅设计范围内且有证据的字段可变，完整配置精确断言。
- 两条相同合法路线从第1关重算候选，最终完整72路线至40，前27关结果/检查点与v19比对。
- 跨波1秒出生无间断；首领独立技能时钟、经济和策略不改。
- 18个既有JSON检查点只迁contentVersion；新检查点由导出器生成，与重模拟精确比较。
- v19整备/胜利迁移与备份/主档写失败保留原档；开发入口禁读写；生产不含开发数据。

## 任务

- [x] 新建`tools/compare-stage30-calibration.test.ts`。基线72路线，重放28/30关诊断；从2条进入28关的完整路线比较局部系数/首领生命/护卫候选，保存5秒采样和战报。finally恢复并断言完整配置。运行`COMPARE_STAGE30_CALIBRATION=1 npx vitest run tools/compare-stage30-calibration.test.ts`（PowerShell用env变量）。
- [x] `src/game/three-cell-balance.test.ts`先锁定v20完整预期配置使v19失败，再改balance JSON；`testing/legacy-approach.ts`精确恢复本轮授权差异并验证历史黄金。
- [x] `persistence.ts`纳入v19；`persistence.test.ts`增加v19迁移成功与写失败；18个旧fixture只改版本。`tools/export-approach-distance.test.ts`添加显式`UPDATE_STAGE30_CALIBRATION_FIXTURE=1`导出当前不聚灵30关检查点，保存为`fixtures/calibration-30-checkpoint.json`。
- [x] `approach-campaign.test.ts`锁定当前72路线与新检查点来源；`three-cell-balance.test.ts`验证30关回滚、重试、升级、结算、保存、31关恢复/招募/禁止重复结算。`ui/useSessionStorage.ts`加calibration30与来源提示，测试禁读写。
- [x] 按game-playtest技能浏览器实战30关；390/320截图、暂停、天赋、下一关、无控制台错误、恢复视口。全量`npm test -- --maxWorkers=2 --reporter=dot`、`npm run build`、生产DEV排除、格式/diff检查；更新README和`docs/reviews/2026-10-21-stage30-calibration.md`，记录局限和后段真实结果。
