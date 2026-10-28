# 首领阶段辨识 Implementation Plan

> 原生顺序执行、自审；用户已持续授权“提交并下一步”，本轮不另启审批或代理，新增代码暂不提交。

**Goal:** 明确首领转阶段门槛及当前阶段，十位首领共享战场二阶段标记。

**Architecture:** CombatStatus 从 bossDefinition(b.stageId) 读取门槛，用敌人 phase2 决定状态文案；boss-phase-marker.ts 只绘制存活二阶段首领，Battlefield复用现有绘图层调用。没有新增模拟/存储状态。

**Tech Stack:** React19、TypeScript、Phaser Graphics、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-27-boss-phase-cues-design.md

## Global Constraints

不改数值、规则、随机、3格、content v24/schema2、存档/收藏格式与容量、素材/清单、依赖/npm命令。静态标记，不引入动画/计时器/每帧对象。

## Review Focus

1. 十位首领门槛来自各自配置，不硬写50%。
2. phase2=false但低血或phase2=true但高血时仍按真实阶段显示。
3. 开场召唤不等于二阶段，普通怪、死怪不画标记。
4. 已有独立二阶段图与缺图回退都可共用，残影不绘制。
5. 暂停、减少动态、短屏无闪烁或横向溢出。

## Task 1：阶段UI与图形

- [x] 修改 src/ui/CombatPanels.tsx 的首领血条：role=progressbar、生命范围和阶段valuetext、第一阶段刻线、阶段说明。
- [x] 修改 src/ui/combat.css：刻线定位，阶段说明使用既有主题，第二阶段暖色，不添加动画。
- [x] 新增 src/render/boss-phase-marker.ts：drawBossPhaseMarker(ground,overlay,enemy,point):void，guard kind/phase2/hp，地面细环与上层双竖线徽记。
- [x] src/render/Battlefield.tsx 活怪循环调用，ground=this.drawing、overlay=this.overlay，原图片/回退逻辑保持。
- [x] 新增 src/ui/boss-phase-status.test.tsx（十首领配置/真实旗标/无或死首领/只读），src/render/boss-phase-marker.test.ts（误标边界/只读/图形边界）。定向验证。

## Task 2：验证与文档

- [x] npm.cmd test、npm.cmd run build、显式启动依赖检查；React/simplify自审、Prettier及git diff --check。
- [x] Chrome独立首领场自然战斗，观察阶段变化与图形，390/320尺寸截图，检查暂停及减少动态；保留正式结算，不用正式收藏。
- [x] 更新README与docs/reviews/2026-10-27-boss-phase-cues.md，记录实际证据与未测项，清理临时页、恢复视口、勾选计划。
