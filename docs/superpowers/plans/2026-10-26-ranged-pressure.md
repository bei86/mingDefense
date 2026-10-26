# 第8/14关远程压力配对实验实施计划

**Goal:** 用同开战档与新种子50关路线核对局部替换翎羽客的收益和退步。

**Architecture:** 测试目录独立同步配置作用域，finally恢复原引用；复用Session、campaign-simulation、伤害观测和路线汇总。局部配对与完整路线使用不同分母，不把后关不同阵容视为同档对照。

**Tech Stack:** TypeScript、Vitest、Node文件工具。

**Spec:** `docs/superpowers/specs/2026-10-26-ranged-pressure-design.md`

## 全局约束与审查重点

- 保持contentv24/schema2、3格接敌、正式数值、仇恨/出怪算法/结算/资源规则、UI、美术、依赖、npm命令和黄金检查点。
- 固定四候选；只改8/14波内远程-1/狼+1，其他字段及总数/时间/入口不变；经验与种类顺序的变化必须公开。
- 历史12加新32（新组有界1–64）；新组起点20270101，候选事先锁定，运行后不调参。
- 同步回调内覆盖，退出/抛错均恢复原引用；不持有候选跨await。
- 相同开局的局部胜负与整条路线的完成关数分别汇总；未到达不补失败，缺失/重复配对拒绝，零同胜不输出均值。
- 当前会话顺序实现、自审；本轮不自动提交或推送，不因技能复核门槛重复请求许可。

## Task 1：可恢复候选与局部配对

Files：新增`src/game/testing/ranged-pressure.ts`、`ranged-pressure.test.ts`。

接口：`withRangedPressure<T>(variant, run:()=>T):T`，候选类型baseline/stage8/stage14/both；`summarizePressureReplays(rows)`按group/stage比较baseline与该关候选。

- [x] 先写测试运行确认模块缺失失败；覆盖四候选精确范围，waveSpawns时间/入口不变，正常返回和抛错恢复原引用，无远程波不改动。
- [x] 实现同步finally作用域，保存原enemies引用，替换新对象，结束复原；baseline不改动。聚合只收原阵与对应局部候选，按seed/policy/boost/group/stage唯一配对。
- [x] 测试局部胜负四分项、同胜用时/生命差、空集、缺失/重复配对拒绝；真实第8/14关Session重复回放确定、原档/配置不变、来源守恒。
- [x] 执行`npx.cmd vitest run src/game/testing/ranged-pressure.test.ts`通过。

## Task 2：固定矩阵工具

Files：新增`tools/compare-ranged-pressure.test.ts`。

- [x] 默认skip，显式COMPARE_RANGED_PRESSURE=1；新组数量默认32，非整数/小于1/大于64立即失败。
- [x] 每组每种子三标签×聚灵，先跑baseline至50；从到达的8/14档回放baseline和局部候选，原阵去掉诊断与原路线逐字段一致。
- [x] 再跑stage8/stage14/both完整50路线；前7/13关结果及档案逐字段等于baseline；每份存档合法，每场正常结算、不超过180秒、伤害与逐兽战报守恒，finally后全配置相等。
- [x] 复用compareCampaignRuns/summarizeCampaignRuns；保留逐关到达/胜负、配对完成关数、终关完整开战档及报告，局部完整开战档与来源汇总；每种子让出事件循环。
- [x] 输出artifacts/ranged-pressure/samples-32.json和summary-32.md，历史/新组分列；显式完整运行1056条路线并核对实际局部到达数，不更改候选。

## Task 3：验证与交付

- [x] 全量测试、npm run build、CHECK_STARTUP_BUILD=1的startup-build通过；simplify自审与Prettier、Git空白检查。
- [x] README记录完整复跑命令；新增`docs/reviews/2026-10-26-ranged-pressure.md`记录实测数据、例子、经验差异、样本限制、当前正式配置保留原因与下一步。
- [x] 完成勾选并汇报前轮提交、新轮结果和未提交状态；不启动新的开发范围。
