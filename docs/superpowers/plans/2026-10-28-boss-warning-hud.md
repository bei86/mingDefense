# 持续横扫预警 Implementation Plan

> 原生顺序实施与自审，按用户持续授权执行，不另启代理；本轮新增开发留工作区。

**Goal:** 在首领HUD持续展示真实已生成横扫预警，包含追击和冻结延期。

**Architecture:** bossWarnings(battle:Combat|null):BossWarning[]纯投影；BossWarnings组件限制两行并呈现状态；CombatStatus在已有首领UI内接入。直接使用游戏内time，没有本地倒计时。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-boss-warning-hud-design.md

## Global Constraints

保留数值/随机、3格、content v24/schema2、存档/收藏格式容量、素材、依赖与npm命令。只读实际预警，不预测下次技能或保证命中。没有新动画、状态或计时器。

## Review Focus

1. 冻结期间due可能已过，优先提示延期。
2. 追击与首段同一行仍分别展示，不按行去重。
3. 来源倒下或退场后不显示残留预警，普通怪不冒充首领。
4. 排序不改源数组、暂停/待选读取不推进时钟或RNG。
5. 多于两条显示总剩余数；320宽换行不溢出。

## Task 1：模型、界面和回归

- [x] 新增src/ui/boss-warnings.ts：BossWarning{source,row,echo,remainingMs,frozen}，从存活首领Map与warnings派生，排序后投影。
- [x] 新增src/ui/BossWarnings.tsx：battle属性，空返回null；group=首领横扫预警，list最多两条；剩余使用Math.ceil(ms/100)/10，冻结优先。增加多余数量及时间说明。
- [x] src/ui/CombatPanels.tsx首领区接入，src/ui/combat.css补紧凑静态配色与换行。
- [x] 新增boss-warnings.test.ts覆盖空/真假来源、顺序、冻结到期、暂停/只读及实际引擎追击生命周期；BossWarnings.test.tsx覆盖隐藏、文案、限制与CombatStatus真实接线。
- [x] 定向回归、全量npm.cmd test、npm.cmd run build、显式启动依赖检查，React/simplify自审及Prettier/diff检查。

## Task 2：实测与交付

- [x] 独立第50关正常战斗观察预警及暂停；390/320截图，无状态注入。自然冻结窗口未捕获，延期由真实引擎/SSR覆盖，未夸称浏览器通过。
- [x] 更新README与docs/reviews/2026-10-28-boss-warning-hud.md，区分实测与模型证明；清理临时标签、恢复视口，完成计划。
