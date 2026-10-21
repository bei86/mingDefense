# 三格关卡校准 Implementation Plan

**Goal:** 修正新三格规则前二十关断点，保留后段待校准结果。

**Architecture:** 只更改战报支持的远程伤害和15/20关首领生命；模拟器和购买策略不改。历史回归加载旧数值，新72路线独立覆盖当前配置，v18备份迁移v17。

**Spec:** docs/superpowers/specs/2026-10-21-three-cell-balance-design.md

**Tech Stack:** TypeScript / Vitest / React / Phaser / Vite。

- [x] tools/compare-three-cell-balance.test.ts比较基线与逐轮诊断收敛的20组候选，finally原位恢复配置；记录到达/胜利、失败时间、战报与生命周期。
- [x] 选最小有效候选，写入原型配置v18；精确断言允许字段，其余完整保留。历史规则配置断言与黄金路线明确隔离。
- [x] 迁移白名单/测试加入v17；16个历史检查点仅更新版本；导出当前三格合法20关检查点，开发入口独立且不读写正式存档。
- [x] 72路线跑至40关，固定真实新结果、守恒与检查点断言；浏览器验证新检查点及当前规则。
- [x] 完整测试maxWorkers=2、构建、生产排除检查、格式/diff与simplify自审，更新README和验收记录；不再自动提交。

实施记录：采用hp-milder，仅三个战斗字段改变；72条中8条过20关、0条过25关。新增独立当前经济检查点与开发入口。完整证据见`docs/reviews/2026-10-21-three-cell-balance.md`。代码发现工具未暴露图谱MCP、仓库无.codegraph，本轮读取指定文件并用rg作后备；没有新增索引或委派代理。
