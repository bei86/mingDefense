# 五十关闭环实施计划

**Goal:** 从v23扩展到50关，旧45存档可续关，提供可复现合法路线和终关试玩。
**Architecture:** JSON内容驱动既有纯模拟；复用护甲、双段横扫、半血召唤，不增加战斗状态。React/Phaser只展示，DEV检查点隔离。
**Tech Stack:** TypeScript、React、Phaser、Vite、Vitest，沿既有依赖。
**Spec:** ../specs/2026-10-22-fifty-stages-design.md

本会话原生执行，不委派代理；用户已要求开发，本轮不自动提交。

## 约束与复核重点

- 前45配置逐字段等于v23；原八灵/经济/RNG/50ms/3格/180秒保持。
- 普攻和技能沿既有逐排规则，追击不跳后排，多格每段只一次。
- 冻结推迟技能，半血不补召，父死保留召唤物并等待清场。
- 迁移失败不覆盖原档，45与50结算幂等，战斗刷新/重试回滚。
- 所有新参数为P；固定策略不代表玩家胜率，缺图不借旧首领身份图。

## Task 1：内容与事务

- [x] 保存主JSON为v23快照，追加46–50和tenthBoss，v24；content增加名称/首领入口，persistence接受v23。
- [x] 新建fifty-stages.test.ts，验证v23完整前缀、双段/前排/冻结/父死/护甲/易伤/召唤/免疫以及v23迁移和50终点回滚。
- [x] 更新旧测试的内容范围、旧45续关断言，历史比较剥离tenthBoss；原fixtures只换版本标识，不改payload。
- [x] 运行typecheck与定向测试，前45结果保持。

## Task 2：平衡与合法检查点

- [x] 新建compare-fifty-stages.test.ts，COMPARE_FIFTY=1执行三组72路线，只缩放新关和第十首领，finally恢复；输出artifacts/fifty-candidates.json。
- [x] 选择保留控制与经济路线的候选，只调整新关；记录真实样本与前45限制。
- [x] 新建export-fifty-stages.test.ts，EXPORT_FIFTY=1导出72条，UPDATE_FIFTY_FIXTURE=1导出46/50检查点。
- [x] approach-campaign.test.ts扩到50，保持前45golden及既有fixture相等，新增终关结果/存档合法/战报与生命周期守恒。

## Task 3：表现与交付

- [x] App/CampaignPanels/index更新五十关终点；Battlefield新增独立终关轮廓，复用双段提示；46/50 DEV入口禁读写测试。
- [x] 添加boss_50_idle/phase2完整复制提示词与素材缺失清单，README更新v24/迁移/50关导出。
- [x] 完整测试、生产构建、格式/差异/旧payload与产物DEV隔离检查；simplify复核新增代码。
- [x] game-playtest在320/390宽试玩46/50、暂停/倍速与结算，保存截图及验收记录；浏览器临时视口恢复。
