# 当前护盾筛选与排序 Implementation Plan

> 用户持续授权本会话自主实施、自审和验收，不派代理，新开发留待下次提交。

**Goal:** 使用现有灵兽筛选/排序快速定位当前有盾或无盾的存活伙伴。

**Architecture:** selectAllies增加shielded/unshielded状态及计数，复用有效盾投影；ally-sorting增加shield指标，AllySelection提供选项和说明，BattleInspection无需新增状态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-shield-selection-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式容量、素材、依赖和默认命令。

## Review Focus

1. 到期、零盾与倒下者旧盾不列有盾，倒下者亦不列无盾存活。
2. 两组计数之和等于当前种类存活数，备战不混入，缺战报不影响有效盾。
3. 当前盾与累计施盾/吸收相反时仍按当前盾，按显示值同值用站位/编号排序。
4. 编号0/同名多实例、空交集、排序保留与筛选失配均沿用既有选择契约。
5. 图鉴挂起返回、快捷定位、逐只查看与普通切页生命周期，窄屏和键盘不回归。

## Task 1：筛选、排序和控件

**Files:** 修改src/ui/ally-selection.ts、ally-sorting.ts、AllySelection.tsx；新增shield-selection.test.tsx，更新ally-selection.test.tsx扩展后的计数期望。

**Interfaces:** AllyStatusFilter增加shielded/unshielded，counts保留Record<AllyStatusFilter,number>；AllySort增加shield。原selectAllies和sortAllies签名不变。

- [x] 写真实盾分类、计数守恒、盾到期/耗尽/死亡、当前/累计区分、同值/0编号、选择/SSR/只读测试，先运行确认新增行为失败。
- [x] 实现存活且有效盾>0或<=0筛选和种类内计数，添加shield降序及当前盾标签；使用明确状态switch保持原筛选语义。
- [x] 添加状态/排序选项及说明，更新旧计数断言；定向筛选/排序/详情/导航测试与typecheck通过。

## Task 2：验收

**Files:** README.md、docs/reviews/2026-10-28-shield-selection.md。

- [x] React/simplify自审，全量测试、build、显式启动边界、Prettier与diff检查通过。
- [x] 独立试玩捕获自然有效盾，核对筛选/排序/图鉴/导航/空态/键盘和390/320截图与日志，正式存档只读。
- [x] 完成README/验收/计划，明确验证边界，恢复视口并关闭试玩。
