# 同检查点布阵实验实施计划

**Goal:** 完成第8/14/20关602检查点、四实验2408场同状态回放，验证备战高阶替换与狐覆盖。

**Architecture:** 提取`runPreparedBattle(session, policy, boost, diagnostics, options)`保留原sample字段；`simulate`调用它且不改变经济/黄金检查点；`formation-replay.ts`独立承载固定合法操作和配对聚合，工具负责批次与产物。

**Tech Stack:** TypeScript、Vitest、Node，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-replay-design.md`

## 全局约束

用户已授权上一轮建议的下一步，顺序自主实施，不派子代理、不重复要求审批。不提交、不推送。保留已有未提交内容；v24数值/三格/运行时/UI/格式/启动命令/fixtures不改。

## Review Focus

1. 单关恢复不重新招募或重掷、原存档不可变、回放原阵与完整路线逐字段相等。
2. 备战满仍能完整多格交换，不跨种/同阶替换，不靠注入资源或切开占格。
3. 多狐不叠加计数、无光环低阶狐/射程天赋区分，候选同分无动作，终止有界。
4. 四实验独立恢复；原组早败不算到达，但变体没有操作仍算一次配对。
5. 局部胜负与50关路线分开；首次倒下50ms观测、护盾吸收不等于提供量，不假称敌方伤害归因。

## 任务1：共用单关执行与合法布阵规则

- [x] 写测试：真实8关prepare checkpoint恢复执行，与simulate该关sample及输入存档相等；第20关同理。先验证缺少函数导致失败，再提取现有单关代码。
- [x] 新`src/game/testing/campaign-battle.ts`导出既有SimulationOptions、BattleSample及runPreparedBattle，simulate重导出类型保持旧调用方；保护桃仍在招募后/检查点前执行，peachMoves观测显式传入。
- [x] 新`src/game/testing/formation-replay.ts`：`replaceReserves(s)`返回操作记录；`improveFoxCoverage(s)`只接受合法严格评分提升，返回记录；`replayFormation(save,policy,boost,variant)`返回开始阵容、记录、额外输出存活指标与BattleSample。使用正常Session命令，动作错误抛出而非静默忽略。
- [x] 新测试覆盖完整占位合法及资源/RNG/拥有权不变，备战满、同种低阶、多狐/无狐/门槛/同分不移动、战斗不可操作。真实检查点各变体确定、可保存，无动作原结果完全一致。

## 任务2：配对工具与报告

- [x] `summarizeFormationReplays(rows)`按关卡/标签/聚灵/种子组配对四实验，拒绝重复和缺配；测试败转胜、胜转败、同胜、同败与空组，无动作仍纳入。
- [x] 新`tools/audit-formation-replay.test.ts`，显式`AUDIT_FORMATION_REPLAY=1`，`FORMATION_REPLAY_SEED_COUNT`默认64、有界1–128。每个原脚本种子跑到20取8/14/20存档；四实验全跑，原阵sample与原路线相等、validSave与战报守恒、配置不变。每种子await setImmediate；写samples/summary JSON及MD到artifacts/formation-replay。
- [x] 先12种子试跑，再64种子全跑核对602检查点、2408战斗。按组记录胜负配对与操作数，挑实际例子说明提升和退步；不按结果改规则再冒充事前实验。
- [x] 写README命令及`docs/reviews/2026-10-23-formation-replay.md`结论；定向/黄金72路线/全量测试、构建、显式startup-build、Prettier和diff空白检查。simplify复查，勾选计划，全部留工作区。

核心测试形式：`expect(replayFormation(checkpoint, 'control', false, 'baseline').battle).toEqual(source.results[stage-1])`；布阵前后`expect({...after.preparation,units:before.preparation.units}).toEqual(before.preparation)`且每只id/kind/rank保持；聚合`expect(summary).toMatchObject({rescued:1,lost:1,bothWon:1,bothLost:1})`。

## 完成记录

2026-10-23完成。12种子112检查点448场试跑通过；64种子602检查点2408场正式回放61.08秒通过，所有原阵逐字段匹配、资源/所有权/RNG保持、战报守恒。无规则调参、无试战选优、无配置变更。

新增8项测试；最终全量856通过、27工具项默认跳过，构建/启动依赖检查通过。simplify复查将单关代码与经济推进拆开，补明确回放返回类型、保留既有天赋选择顺序。实验结论：同种高阶仅25场有动作，2场救回且来自同种子的聚灵开关；狐覆盖在20关5场救回、11场丢失，未接自动布阵。

验收：`docs/reviews/2026-10-23-formation-replay.md`。全部留工作区，未提交、未推送；下一项建议为可核对的同种高阶备战提示。
