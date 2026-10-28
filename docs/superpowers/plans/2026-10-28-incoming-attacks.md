# 敌人准备攻击来源 Implementation Plan

> 用户持续授权本会话实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 从敌人查看真实准备攻击来源并准确跳转。

**Architecture:** incomingAttacks(battle,enemyId)返回逐动作只读投影，enemyInspection附incoming，EnemyIncoming使用原生details和onSelect(id)，EnemyInspection复用onTarget。

**Tech Stack:** React19、TypeScript、Vitest、浏览器/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-incoming-attacks-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 真实准备到释放后消失；不把范围伤害潜在对象当直接目标。
2. 同号0/同种来源不混淆；狐施盾、桃、敌方动作、缺失/倒下来源排除。
3. 队列排序不修改原数组，坐标复制，倒计时下限0。
4. 跳转清筛选、保留灵兽排序、聚焦并暂停，详情往返保留实例。
5. 零项和长名称在390/320可读，Tab/Enter/Space与44px按钮有效。

## Task 1：投影、展示与接入

**Files:** 新增src/ui/incoming-attacks.ts、EnemyIncoming.tsx、incoming-attacks.test.tsx；修改enemy-inspection.ts、EnemyInspection.tsx。

**Interface:** `IncomingAttack={source:Pick<Ally,'id'|'kind'|'rank'|'position'>;ordinal:number;remainingMs:number}`；`incomingAttacks(battle:Combat|null,enemyId:number):IncomingAttack[]`；组件接收actions和onSelect。

- [x] 新增真实stepCombat准备及releaseAttack对照、阵营/施盾/死亡过滤、同号0、排序和SSR/只读测试，先运行确认失败。
- [x] 实现过滤存活敌人及存活攻击者、复制坐标，按due/source/ordinal排序后映射`remainingMs:Math.max(0,attack.due-battle.time)`。
- [x] enemyInspection增加incoming投影；组件默认收起，展开渲染来源按钮、动作次数和倒计时/待释放/零项，说明直接目标与非命中预测边界。
- [x] 接入EnemyDetails，key按enemy.id复位，onSelect复用onTarget；定向测试与typecheck通过。

## Task 2：验收与交付

**Files:** README.md、docs/reviews/2026-10-28-incoming-attacks.md。

- [x] React best practices与simplify自审，全量、build、显式启动检查、格式和diff检查。
- [x] 自然隔离第50关暂停验证名单、跳转、焦点、键盘、往返和390/320；截图目视，清理试玩，正式档只读。
- [x] 更新README/验收/计划，留工作区待下次提交。
