# 横扫预警快捷查看 Implementation Plan

> 按用户持续授权原生顺序实施与自审，不另启代理；本轮新增开发留工作区。

**Goal:** 点击真实横扫/追击预警即可暂停并查看对应首领及波及灵兽。

**Architecture:** pauseForBossWarning(session,battle,target)重验并暂停；App以单个inspection对象携带可选initialWarning；BattleInspection初始化敌人页，EnemyInspection/EnemyWarnings置前并展开所点名单。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-warning-inspection-design.md

## Global Constraints

保留战斗规则/数值/RNG、3格、content v24/schema2、存档/收藏格式容量、素材、依赖和默认命令。只查看当前真实预警，不预测伤害；关闭仍暂停。

## Review Focus

1. 展示到点击之间预警释放、来源倒下或换场，不操作无效目标。
2. 冻结改变due但不改变本次来源/行/echo匹配。
3. 首段与追击独立定位；普通菜单进入不能沿用旧目标。
4. 进入详情仅修改paused/held，不修改战斗、随机或保存格式。
5. 波及名单默认展开仍可手动折叠，切换敌人/灵兽与图鉴返回保持暂停。

## Task 1：事件验证与回归

**Files:** 新增src/ui/warning-inspection.ts、src/ui/warning-inspection.test.ts；导出src/ui/boss-warnings.ts的BossWarningTarget类型。

**Interfaces:** `pauseForBossWarning(session:Session,battle:Combat,target:BossWarningTarget):BossWarningTarget|null`；目标为`Pick<BossWarning,'source'|'row'|'echo'>`。

- [x] 核对上述类型与模型投影一致。
- [x] 实现阶段/选择/战斗引用/真实预警匹配guard，通过后调用session.pause(true)并返回目标副本。
- [x] 测试真实Session自然生成双段，冻结due变化仍有效，暂停与held释放且tick不推进；预警释放、来源倒下/退场、普通怪、错行/echo、跨场、整备/结算/待选拒绝且前后JSON一致。

## Task 2：快捷入口与详情接线

**Files:** 修改src/ui/BossWarnings.tsx、CombatPanels.tsx、App.tsx、BattleInspection.tsx、EnemyInspection.tsx、EnemyWarnings.tsx、combat.css；新增src/ui/warning-inspection-ui.test.tsx。

- [x] BossWarnings和CombatStatus透传可选`onInspectWarning(battle,target)`，无回调仍为只读摘要；有回调时渲染44px按钮。
- [x] App用`{warning?:BossWarningTarget}|null`替代inspection布尔；验证成功后clock.reset并打开详情，普通菜单设空对象、关闭设null。
- [x] BattleInspection用initialWarning初始化side/enemyId，显示行/追击定位说明。EnemyInspection只将匹配来源的目标传给EnemyWarnings；快捷进入时将预警区置于详细档案前，匹配行和echo名单默认展开。
- [x] SSR覆盖首段/追击定位、不同来源不错误展开、普通入口不展开、入口无障碍及只读；定向/全量测试、构建、启动边界、格式和自审。

## Task 3：正常UI实测和文档

- [x] 第50关独立战斗自然点击预警，核对暂停、所选首领、行名单、关闭仍暂停、普通入口无残留；键盘Enter入口及图鉴往返。
- [x] 390/320截图与溢出检查，清理临时标签/视口，正式页恢复后核对进度。
- [x] 更新README和docs/reviews/2026-10-28-warning-inspection.md，记录测试与浏览器的实际边界。
