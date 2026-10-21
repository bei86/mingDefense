# 5格接敌距离 Implementation Plan

> 历史5格版本：已被用户后续选择的3格方案取代，当前结果见 [三格与清晰度验收](../../reviews/2026-10-21-three-cell-rendering.md)。以下保留当时设计及验证记录。

> 按用户已确认的5格方案在当前会话直接实施；保留未提交界面改动，不自动提交或推送。

**Goal:** 满阵时所有现有波次怪先走近再普攻。

**Architecture:** 波次出生行从-1改为-5，仿真仍使用同一坐标系。守卫镜头缩放显示整段接敌区，整备镜头与点击格保持原状。

**Tech Stack:** TypeScript / React / Phaser / Vitest / Vite。

**Spec:** docs/superpowers/specs/2026-10-21-enemy-approach-distance-design.md

## Global Constraints

保持6×6阵地、连续每秒出怪、仇恨及射程；召唤/分裂仍在父怪位置。内容版本v16，v15旧档先备份后迁移。参数标注P；不调整生命攻击弥补难度变化。

## Review Focus

满首排的远程与首领也必须移动；冻结与减速仍延缓接敌；召唤与分裂不能传回入口；整备点击格不受镜头影响；小屏入口/首领/底排及聚灵按钮可达。

## Task 1: 规则与兼容

- [x] 在 src/game/approach-distance.test.ts 添加出生距离、进入射程与200ms前摇、冻结减速及子怪位置测试；修改前执行并确认失败。
- [x] 保存v15配置快照，配置 spawnRow=-5、contentVersion=prototype-2026-10-21-v16、status=prototype-forty-stages-v16；persistence.ts 白名单加入v15。
- [x] persistence.test.ts 加入v15整备/胜利迁移及写失败检查；保留阵容/奖励，下一战使用新出生线。

## Task 2: 战场取景

- [x] Battlefield.tsx 准备态360×416、zoom=1；守卫态360×480、zoom=.75、中心(180,100)，全体图形/精灵/技能统一相机变换。
- [x] 接敌区显示路径和阵地边界，不能部署；DOM准备格坐标保持不变；返回整备重置相机与尺寸。
- [x] 浏览器320/390及桌面验证满阵与首领入口、移动、暂停/返回和聚灵控件，截图保存 artifacts/。

## Task 3: 路线与回归

- [x] 使用72条合法经济路线记录新版真实结果，单独固定新规则回归；因0条通过第15关，后段保留历史1格路线检查点且标注来源，只迁移版本字段。历史配置比较仅规范化出生行，另以v15快照验证其他所有数值未动。
- [x] 执行 npm test、npm run build、Prettier与git diff检查；按 simplify 技能自审本次改动。
- [x] README和docs/reviews记录新接敌规则、实测胜率变化、验证范围及限制。
