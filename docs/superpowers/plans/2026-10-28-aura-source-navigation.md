# 暂停攻击光环来源定位 Implementation Plan

> 用户持续授权在本会话实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 从攻击灵兽当前属性直接定位提供光环的具体月音狐。

**Architecture:** AuraSources 接收 BattleStatsModel['auraSources'] 和 onSelect(id)，只渲染来源按钮。BattleStats 传递 onSource，BattleInspection 接入既有 showAlly，不增加战斗或选择状态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-aura-source-navigation-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 同名同阶多狐按准确编号跳转，编号0有效。
2. 倒下、低阶、范围外不列入来源，无覆盖无按钮。
3. 原筛选隐藏目标时清除筛选，保留排序并聚焦实例下拉框。
4. 目标属性重新收起、图鉴往返保留目标、战斗不推进。
5. 长编号/坐标可换行、320宽度无横溢，键盘和触控可用。

## Task 1：来源按钮与接入

**Files:** 新增 src/ui/AuraSources.tsx、src/ui/aura-sources.test.tsx；修改 src/ui/BattleStats.tsx、src/ui/BattleInspection.tsx、src/ui/battle-stats.css。

**Interface:** AuraSources({sources: BattleStatsModel['auraSources'], onSelect: (id:number)=>void})；BattleStats 新增必需 onSource:(id:number)=>void。

- [x] 使用真实 createCombat 和 battleStats 的来源投影测试SSR：同阶多狐的坐标/编号、编号0、不可用来源排除、空名单隐藏、完整Combat只读。先运行 `npx.cmd vitest run src/ui/aura-sources.test.tsx` 确认缺模块失败。
- [x] 无状态组件空名单返回null，否则用 `sources.map(source => <button onClick={() => onSelect(source.id)} ...>)`；显示阶数、1起坐标和编号，完整 accessible name。
- [x] BattleStats 原来源名单替换为 `<AuraSources sources={model.auraSources} onSelect={onSource} />`；BattleInspection 传 `onSource={showAlly}`；CSS按钮宽100%、至少44px、文本换行。
- [x] 定向来源、属性、选择和导航测试及typecheck通过。

## Task 2：验收与记录

**Files:** README.md、docs/reviews/2026-10-28-aura-source-navigation.md。

- [x] React/simplify自审；全量测试、build、显式CHECK_STARTUP_BUILD=1启动检查、Prettier与git diff --check。
- [x] Chrome独立第50关自然暂停，攻击灵兽筛选/排序后查看来源，鼠标与键盘准确跳转、检查焦点/筛选/排序/暂停/图鉴往返，390/320截图目视检查。
- [x] 正式档只读核对，恢复视口、清理试玩，更新README与验收记录并勾选计划，新开发留工作区。
