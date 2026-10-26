# 敌方伤害来源诊断实施计划

**Goal:** 查清8/14/20关实际扣血与护盾吸收来源，提供数值校准证据。

**Architecture:** Combat与Packet外部WeakMap保存瞬时来源和聚合，只在显式开启后收集；正常结算逻辑保持。测试模拟助手增加可选结果字段，独立工具复跑合法原阵检查点并验证守恒。

**Tech Stack:** TypeScript、Vitest、现有Session模拟与Node文件工具。

**Spec:** `docs/superpowers/specs/2026-10-26-enemy-damage-audit-design.md`

## 全局约束与审查重点

不调整数值、RNG、schema2/contentv24、3格接敌、出怪、存档、战报/收藏格式、UI、美术、依赖或npm命令。本轮新内容不自动提交、不推送，当前会话直接顺序实现、自审。

- 护盾先吸收、扣血封顶；不把过量或同一步死后命中当承伤，致重伤只记一次。
- 同步击杀的攻击来源仍保留；子怪按自己记，owner只作关联。
- 未知和中途观测明确标注，快照不可反向改动聚合。
- 每场及逐目标扣血/吸盾守恒；关掉观测所有旧输出逐字段相等。
- 显式工具才能写产物，默认测试不写文件；固定脚本不等于玩家胜率。

## Task 1：瞬时观测与结算接入

- [x] 新增 `src/game/enemy-damage-diagnostics.test.ts`，先验证缺模块失败。
- [x] 新增 `src/game/enemy-damage-diagnostics.ts`，导出 `observeEnemyDamage(s)`、`tagEnemyDamage(s,packet,enemy,attack)`、`recordEnemyDamage(s,packet,hpLoss,shieldAbsorbed,lethal)`、`enemyDamageSnapshot(s)`及类型；WeakMap只保存明确字段，快照克隆并排序。
- [x] 在 `combat-skills.ts` 普攻生成包、`combat.ts` 横扫/追击生成包处暂记来源；在原扣血/吸盾统计位置追加只读观测，所有伤害运算及执行顺序保持。
- [x] 运行定向测试，包含同一步死亡、未知/部分记录、子怪与多来源过量；检查Combat序列化未新增字段。

## Task 2：合法回放与诊断工具

- [x] `testing/campaign-battle.ts` 增加 `SimulationOptions.enemyDamage?:boolean` 和可选 `BattleSample.enemyDamage`；开战后启动观测，结算后输出快照，未开启时不增加字段。
- [x] 新测试真实Session原阵与观测结果逐字段对照、保存及配置不变、逐目标/全场守恒。
- [x] 新增 `tools/audit-enemy-damage.test.ts`，默认跳过；64种子×三领取标签×聚灵开关，到达8/14/20关后从合法开战档恢复原阵，观测并对照原路线，按种子setImmediate让出事件循环。
- [x] 输出 `artifacts/enemy-damage-audit/samples-64.json` 与 `summary-64.md`；记录真实到达数，按种类/攻击方式聚合；显式完整运行并分析高压力来源，不修改数值。

## Task 3：验证与交付

- [x] 全量测试、typecheck/build、显式startup-build通过；检查无新UI、存档或依赖变更，按simplify自审。
- [x] README补工具命令与口径，`docs/reviews/2026-10-26-enemy-damage-audit.md`记录实际诊断结论、守恒及局限；计划勾选、Prettier与Git空白检查。
