# 第37–40关校准实施计划

**Goal:** 完成37/40断点局部P数值校准，控制和经济路线各完成40关，含不聚灵路线。

**Architecture:** 复用纯模拟器/合法购买策略和可选生命周期观测；诊断工具临时改配置并finally原位恢复。v22迁移和DEV检查点与正式存档隔离，历史和当前规则独立断言。

**Tech Stack:** TypeScript / React / Phaser / Vitest / Vite。

**Spec:** docs/superpowers/specs/2026-10-21-stage40-calibration-design.md。

**执行方式：** 用户已明确授权本会话继续开发，直接实施，不委派代理，不自动提交本轮新开发。

## 约束与检查重点

- 前36关和三格/仇恨/八灵/经济/策略/首领机制保持；38/39只在新路线确有断点时局部调整。
- 减少40关护卫时同步提前波次，普通怪仍按0、1000、…连续出生。
- 比较72路线前36关完整结果、至37关检查点；20个旧JSON仅迁版本。
- v21整备/胜利迁移及备份/主档写失败；DEV禁读写和生产排除。
- 最终通关不创建41关、不重复结算、不刷新招募扣钱，保存/恢复完成态。

## 任务

- [x] 新建 `tools/compare-stage40-calibration.test.ts`，基线72路线及37/40消融、局部系数与护卫/首领候选，完整重算/重放，输出5秒采样/战报/生命周期并finally精确恢复。
- [x] `src/game/three-cell-balance.test.ts`先锁定v22完整预期并观察旧配置失败，再改balance JSON；`testing/legacy-approach.ts`只恢复本轮差异，保持历史黄金。
- [x] `persistence.ts/.test.ts`加入v21迁移及失败保护，20个JSON仅迁版本；`tools/export-approach-distance.test.ts`增加显式40关检查点导出。
- [x] `approach-campaign.test.ts`固定完整72路线/40关合法来源；新最终关回滚/重试/天赋/结算/完成保存/拒绝41关测试；DEV calibration40及禁读写测试。
- [x] game-playtest真实通过40关，390/320布局、暂停/回滚/天赋/最终完成及生产隔离；全测试/构建/格式/diff；更新README与验收记录并自审本轮代码。

完成证据：`docs/reviews/2026-10-21-stage40-calibration.md`。新39关断点有诊断依据；38关不改。最终关无本关升级，有选择队列继续由25/30检查点覆盖。
