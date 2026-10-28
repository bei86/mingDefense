# 暂停准备动作目标定位 Implementation Plan

> 用户持续授权本会话实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 准备攻击/施盾的存活目标可准确定位。

**Architecture:** battleAction新增BattleActionTarget={side:'ally'|'enemy';id:number}并附在pending。BattleAction使用onTarget回传该对象；BattleStats透传，BattleInspection.showActionTarget路由既有showAlly/showEnemy。

**Tech Stack:** React19、TypeScript、Vitest、浏览器/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-action-target-navigation-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 月音狐施盾与普通攻击按正确阵营、准确编号定位，双方同号与0编号有效。
2. 同名目标不混淆，倒下/退场保留文本但无按钮。
3. 无准备动作/桃/倒下施动者无目标按钮，读取不变Combat/RNG。
4. 快捷定位清筛选、聚焦目标并保持暂停；图鉴/敌情往返保留实例。
5. 390/320长名称换行、44px按钮与键盘操作可用。

## Task 1：目标模型、按钮与接入

**Files:** 修改src/ui/battle-action.ts、BattleAction.tsx、BattleStats.tsx、BattleInspection.tsx、battle-action.test.ts；新增src/ui/action-target-navigation.test.tsx。

**Interface:** 导出BattleActionTarget；BattleAction及BattleStats新增必需onTarget:(target:BattleActionTarget)=>void。

- [x] 新增真实准备动作、同号0编号双方、同名实例及无效目标SSR/只读测试，运行 `npx.cmd vitest run src/ui/action-target-navigation.test.tsx` 确认先失败。
- [x] pending增加 `{target:{side:ally.kind==='shield_fox'?'ally':'enemy',id:attack.target}}`；维持targetAlive、标签、排序和倒计时。
- [x] 存活动作目标显示原生button、完整aria-label及查看目标；失效保留原span/说明。复用inspection-link CSS，click回传target，父级统一路由showAlly/showEnemy。
- [x] 更新原测试的精确模型预期和必需回调，运行定向动作/选择/导航测试及typecheck。

## Task 2：验证与交付记录

**Files:** README.md、docs/reviews/2026-10-28-action-target-navigation.md。

- [x] React/simplify自审，全量、build、显式CHECK_STARTUP_BUILD=1启动检查、Prettier和git diff --check。
- [x] 独立自然第50关暂停验证攻击/施盾目标跳转、焦点、图鉴/敌情往返、键盘和390/320布局；恢复视口、清理试玩，正式档只读。
- [x] README与验收记录更新，计划勾选，新开发留待下次提交。
