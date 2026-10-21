# 第33–35关校准实施计划

**Goal:** 完成33/35关断点诊断和局部P数值校准，让控制/经济两路线完成35关，包含不聚灵路线。

**Architecture:** 纯局部配置调整，不改模拟器和购买/天赋策略；诊断工具只产生证据，finally原位恢复。v20备份迁移、当前DEV检查点与正式存档隔离；历史回归和当前规则完整断言分开。

**Tech Stack:** TypeScript / React / Phaser / Vitest / Vite。

**Spec:** docs/superpowers/specs/2026-10-21-stage35-calibration-design.md

**执行方式：** 延续用户已授权的下一步，当前会话完成，不派子代理，不自动提交本轮新开发。

## 约束与检查重点

- 前32关和36–40配置、经济/策略、三格/逐排/仇恨/八灵/首领机制保持；只改有诊断依据的局部字段。
- 减少护卫时按各波实际数量连续设置起点，不能引入空档。
- 基线与最终72路线前32关完整结果/至33关检查点比较，后段结果真实公开。
- 19个既有JSON只迁版本，新35关检查点可由完整合法路线重新生成。
- v20整备/胜利迁移、两处写失败；DEV禁读写、生产排除；下一关恢复/刷新不重复奖励。

## 任务

- [x] 新增`tools/compare-stage35-calibration.test.ts`：基线72路线，重放33/35关消融，候选从2条相同路线完整重算至40，输出战报/5秒采样/生命周期；每组让出事件循环供Vitest通信，finally精确恢复。
- [x] `src/game/three-cell-balance.test.ts`先锁定v21完整预期并验证v20失败，再修改balance JSON。扩展`testing/legacy-approach.ts`仅还原本轮授权差异，历史回归保留。
- [x] `persistence.ts`和`persistence.test.ts`纳入v20成功与失败迁移；19个JSON仅迁版本；`tools/export-approach-distance.test.ts`显式`UPDATE_STAGE35_CALIBRATION_FIXTURE=1`导出`fixtures/calibration-35-checkpoint.json`。
- [x] `approach-campaign.test.ts`固定当前72路线与检查点来源；`three-cell-balance.test.ts`扩展35关回滚/天赋/保存/36关恢复/免费刷新/不重复结算；`ui/useSessionStorage.ts`增加calibration35、来源提示和禁读写测试。
- [x] game-playtest浏览器实际通过35关，验收390/320视口、暂停/重开/天赋/下一关与控制台；完整测试/构建/生产排除/格式/diff，更新README、设计及`docs/reviews/2026-10-21-stage35-calibration.md`。

完成记录：见 `docs/reviews/2026-10-21-stage35-calibration.md`。35关合法检查点无本关升级选择，25/30关继续覆盖有选择流程；新关卡回滚、结算、下一关刷新均通过。
