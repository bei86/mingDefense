# 三类策略50关平衡诊断实施计划

**Goal:** 完成1536条同配置配对路线，定位失败并交付可复跑诊断及结论。

**Architecture:** 既有simulate添加默认关闭的策略与观测选项；新campaign-audit模块管理合法保护桃与纯聚合；工具只负责矩阵执行、进度和产物。游戏运行时与配置不改。

**Tech Stack:** TypeScript、Vitest、Node文件输出，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-campaign-balance-audit-design.md`

## 全局约束

沿用户同意的“平衡诊断”执行，顺序实现、不派子代理。保持v24/三格接敌/全部数值规则/现有命令/依赖和存档格式。保留尚未提交的阵型分享功能。本轮不自动提交或推送。64种子×3策略×2聚灵×4实验，前12种历史、后52种新增，报告不称玩家胜率或三纯构筑证明。

## Review Focus

1. 可选观测不能改变黄金路线、结算、检查点或随机数。
2. 合法桃后排只能严格增加起点行，多格完整占格合法且不消耗资源。
3. 天赋优先顺序固定，不能按种子或已知终局挑选策略。
4. 关卡完成率分母必须列出到达样本；全灭和时限不同。
5. 配对比较不可混用种子、领取策略、聚灵状态；工具默认不运行/不写文件。

## 任务1：可观测策略实验与定向测试

Files: 改`src/game/testing/campaign-simulation.ts`；新`src/game/testing/campaign-audit.ts`及测试。

- [x] 写失败测试：`simulate(20261014,'assault',false,15,false,{audit:true})`与默认结果去掉audit后逐字段相等，检查点完全相等；保护桃前后校验validFormation、资源/rng相等。
- [x] 在simulate可选第六参数加`protectPeach/survivalBuffs/audit`，只在显式开关执行。audit包含开战统计、第一只倒下、结束存活敌人/待出；原sample默认不加字段。
- [x] 实现`protectPeaches(session: Session): number`：按桃ID遍历、优先最靠后合法空位或合法交换（swapError），只选比当前行更后的位置，每次通过transfer/swap；无改善零操作。
- [x] 固定生存天赋顺序；同一个真实失败重跑验证audit的首次倒下/终局、两种合法干预确定性、可保存状态与观测不漂移。

## 任务2：聚合与矩阵工具

Files: 新`tools/audit-campaign-balance.test.ts`；新聚合代码与测试；README/review。

- [x] `summarizeCampaignRuns`按策略/聚灵/实验/种子组统计运行数、终关完成、每关到达/胜利/失败、首次失败分布、失败原因；`compareCampaignRuns`同key配对列出改善/退步/不变，改善以完成关数为准。
- [x] 聚合测试用真实小路线及明确合成样本验证早败不计后关到达、完整通过、timeout/wiped、均值分母、重复/缺失配对拒绝。
- [x] 显式`AUDIT_CAMPAIGN_BALANCE=1`运行，种子数可用`AUDIT_SEED_COUNT`有界1–128覆盖（默认64）；四实验分别输出进度，生成JSON完整紧凑观测与Markdown汇总，不改fixtures或配置。
- [x] 先12种子试跑核对历史2条终关，再64种子完整1536条；逐组检查结果，记录策略效应及新增验证组、首败关和承伤/伤害来源。无证据不改数值。
- [x] 定向/黄金72路线/全量测试、build、startup-build、Prettier/空白及simplify复查；README写命令、报告写可核查结果与下一步，勾计划，新功能留工作区。

## 完成记录

288路线试跑通过；1536路线正式复跑188.46秒干净通过，与首次计算产物SHA-256完全相等。长循环加入每种子setImmediate，解决worker进度通信超时。simplify复查保留原天赋默认分支，单独覆盖实验优先级，避免嵌套三元。

最终全量848项通过、26工具项默认跳过，12.75秒；TypeScript/生产构建及显式startup-build通过。配置、fixtures与运行时未改，本轮无浏览器玩法验证。原脚本/桃后移/生存天赋/组合分别8/6/24/10条完成50关（各384条），无数值调整。

详情：`docs/reviews/2026-10-23-campaign-balance-audit.md`。保留阵型分享改动，全部留工作区，不提交、不推送。
