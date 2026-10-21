# 第25关校准实施计划

**Goal:** 消除当前三格规则第25关全部固定策略失败的断点。

**Architecture:** 纯配置校准；Session模拟器和固定购买策略不改，诊断仅驻留工具。旧黄金数据与当前规则分开，存档用v19备份迁移。

**Spec:** docs/superpowers/specs/2026-10-21-stage25-calibration-design.md

**Tech Stack:** TypeScript / React / Phaser / Vitest / Vite。

**执行方式：** 当前会话直接完成用户已授权的下一步，不委派代理、不再次提交。

## 约束与重点

- 只改诊断支持的第25关数值，三格/逐排/等级/仇恨/八灵/连续出怪/前24关/经济保留。
- 原位恢复配置，避免content.ts缓存引用失效；新测试精确锁定差异。
- v18 prepare/victory档均保留阵容成长、收益和战报；写入失败不覆盖旧档。
- 当前20关检查点与旧stage系列载荷保留；新25关来源可重新模拟证明，入口禁止读取正式存储。
- 候选不会改购买策略；后段结果照实记录；窄屏可见性、暂停/重试和生产入口隔离需验证。

## 任务

- [x] 新增`tools/compare-stage25-calibration.test.ts`：重用72条固定路线；从基线检查点隔离压力因素，再比较生命候选，输出战报和时间采样；finally断言恢复。运行`COMPARE_STAGE25_CALIBRATION=1`的Vitest用例。
- [x] `src/game/three-cell-balance.test.ts`先锁定所选v19完整配置，确认当前v18失败，再修改`docs/superpowers/specs/2026-10-14-prototype-balance.json`。扩展`testing/legacy-approach.ts`仅恢复新授权差异，保持历史测试结果。
- [x] `persistence.ts`白名单加入v18，`persistence.test.ts`覆盖成功和两处写入失败。现有17个JSON检查点仅替换contentVersion；`tools/export-approach-distance.test.ts`增加显式25关导出开关；新合法检查点在`fixtures/calibration-25-checkpoint.json`。
- [x] `ui/useSessionStorage.ts`加入独立`calibration25`入口，`ui/useSessionStorage.test.ts`验证禁读存储；当前72路线和检查点/重试测试更新，26–40结果照实固定。
- [x] 浏览器实际打第25关、移动视口、下一关整备；完整`npm test -- --maxWorkers=2 --reporter=dot`、`npm run build`、格式和diff检查，更新README与验收记录。新开发保持未提交。
