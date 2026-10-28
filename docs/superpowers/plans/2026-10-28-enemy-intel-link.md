# 敌人敌情快捷查阅 Implementation Plan

> 按持续授权原生顺序实施与自审，不另启代理；本轮新增开发留工作区。

**Goal:** 从暂停中的所选敌人直达本关该种规则，往返保留筛选与实例。

**Architecture:** EnemyInspection的可选onIntel(kind)经BattleInspection透传到App；App用单个intel对象保留目标关和可选种类。StageIntel在目标关顶部复用EnemyCard显示配置档案，原详情suspended而不卸载。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-intel-link-design.md

## Global Constraints

保持战斗规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式与容量、素材、依赖、默认命令。

## Review Focus

1. 普通/首领/召唤狼/碎片必须定位正确种类，不将即时生命误当基础值。
2. 当前候选或空队列必须保留真实计数，目标缺失不定位其他敌人。
3. 挂载保留筛选/编号，隐藏底层只保留一个可访问dialog，关闭仍暂停。
4. 原整备、暂停和战役进度的关卡浏览与返回不改变。
5. 320窄屏档案可读且无溢出，顶端关闭入口可用。

## Task 1：目标档案与组件回归

**Files:** 修改src/ui/StageIntel.tsx，新增src/ui/enemy-intel-link.test.tsx。

- [x] 写目标档案SSR测试先确认失败，覆盖四类定位、不重复、候选队列、缺失目标和普通布局兼容。
- [x] 增加initialEnemyKind?:EnemyKind，在初始目标关从intel.enemies/derived查找；顶部显示档案或缺失说明，下方排除已显示卡片，正常列表空时隐藏标题。
- [x] 定向通过，渲染前后队列/Session JSON一致。

## Task 2：入口与导航接线

**Files:** 修改src/ui/EnemyInspection.tsx、BattleInspection.tsx、App.tsx，补src/ui/enemy-intel-link.test.tsx。

- [x] 两级可选onIntel:(kind:EnemyKind)=>void；仅有回调与实例时显示复用样式的查看按钮，包含敌名。
- [x] intel改为{stageId:number,enemyKind?:EnemyKind}|null；现有入口包装stageId，详情入口带kind；StageIntel透传目标与实际battle.spawns，关闭文案优先返回详情。
- [x] BattleInspection suspended包含intel，保持挂载；SSR覆盖入口和隐藏只读，回归预警/筛选/StageIntel。
- [x] React/simplify自审，定向/全量、构建、显式启动依赖、格式和diff检查。
- [x] Chrome独立第50关自然UI验证狼/首领档案、切关与返回、筛选/实例保留、390/320截图；清理临时页核对正式档。
- [x] 更新README、docs/reviews/2026-10-28-enemy-intel-link.md并勾计划，新增开发留工作区。
