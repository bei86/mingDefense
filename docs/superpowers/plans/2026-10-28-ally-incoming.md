# 灵兽准备普攻来源 Implementation Plan

> 用户持续授权本会话顺序实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 从灵兽查看敌方已准备的普攻并准确定位来源。

**Architecture:** allyIncoming(view,unitId)复用EnemyInspectionView.attack.pending投影；AllyIncoming原生details展示独立名单；BattleInspection在AllyThreats旁接入，复用showEnemy。

**Tech Stack:** React19、TypeScript、Vitest、浏览器/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-ally-incoming-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 准备目标独立于缓存锁定；真实到期伤害原目标并从队列移除。
2. 冻结期间准备剩余不流逝；冻结0准备显示待解冻，不暗示立刻释放。
3. 两方同号0、同名来源、重复动作保留，失效目标/来源排除。
4. 不混入横扫/己方动作；投影不改Combat或敌情快照。
5. 零项、实例切换、图鉴往返、焦点、键盘、390/320长名称可读。

## Task 1：投影与组件接入

**Files:** 新增src/ui/ally-incoming.ts、AllyIncoming.tsx、ally-incoming.test.tsx；修改BattleInspection.tsx。

**Interface:** `IncomingEnemyAttack={source:{id:number;name:string};remainingMs:number;frozenMs:number}`；`allyIncoming(view:EnemyInspectionView|null,unitId:number):IncomingEnemyAttack[]`；组件接收actions与onSelect(id)。

- [x] 写真实准备/目标改锁/到期、冻结/解冻、同号0与无效过滤、排序重复及SSR/只读测试，先运行确认失败。
- [x] 遍历view.enemies的attack.pending，过滤`pending.targetId===unitId && pending.targetAlive`，复制来源id/name与计时，按source.id/remainingMs排序。
- [x] 原生details默认关闭，展开才挂载内容。冻结使用“冻结剩余X秒”“解冻后准备X秒”或“待解冻”；正常使用“准备剩余X秒”或“待释放”。按钮回传准确来源编号，复用inspection-link样式。
- [x] BattleInspection使用key=unit.id，在缓存锁定名单旁接入，onSelect=showEnemy；运行定向测试和typecheck。

## Task 2：验收与记录

**Files:** README.md、docs/reviews/2026-10-28-ally-incoming.md。

- [x] 按React best practices/simplify自审，全量、build、显式启动、Prettier和diff检查。
- [x] 独立自然试玩捕获真实敌方准备普攻，验证来源/目标往返、暂停、键盘、图鉴往返、实例切换与390/320截图目视；正式档只读，恢复视口与清理临时tab。
- [x] 更新README/验收记录与计划，新开发留待下次提交。
