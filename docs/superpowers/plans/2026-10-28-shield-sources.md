# 战斗施盾可达来源 Implementation Plan

> 用户持续授权本人自主实施、自审和验收，不派代理；本轮新增内容留工作区，下轮提交。

**Goal:** 从任意灵兽反查当前施盾范围覆盖它的月音狐并双向定位。

**Architecture:** shield-coverage.ts的shieldSources与原shieldCoverage共用局部距离判断，模型只读；ShieldSources置于已展开BattleStats内，复用onSource与覆盖列表样式。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-shield-sources-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖与默认命令。

## Review Focus

1. 桃/狐/低阶/编号0合法，来源不套用攻击光环的阶数与目标排除条件。
2. 逐对前后向一致，多格整体中心精确边界与射程天赋沿实际引擎。
3. 当前满盾、冷却/准备都不改变几何范围；不暗示未来获盾或已有盾来源。
4. 来源/目标倒下、退场、备战与无覆盖时不生成虚假定位入口，模型不可回写Combat。
5. 筛选中来源定位清条件保留排序，图鉴保留展开、换对象重置，键盘与窄屏可用。

## Task 1：互逆投影与展示

**Files:** 修改src/ui/shield-coverage.ts；新src/ui/ShieldSources.tsx、src/ui/shield-sources.test.tsx。

**Interfaces:** shieldSources(battle:Combat|null,targetId:number):ShieldSourcesModel|null；model={targetId:number,alive:boolean,sources:{id:number,rank:number,position:Point,range:number}[]}；ShieldSources({model,onSelect})接收nullable模型与(id:number)=>void。

- [x] 添加真实Combat逐对前后向/实际shieldTarget、边界/天赋/低阶/自身/桃/编号0、死亡与备战/无覆盖、满盾/冷却/准备、排序副本/只读和SSR测试，先确认失败。
- [x] 提取局部withinShieldRange(source:Ally,target:Ally,range:number):boolean供两方向复用，先找存活目标再筛来源、派生射程、按站位排序并复制坐标。
- [x] 实现默认收起名单，自身/空/死亡/null分别说明；独立可访问名称，复用既有样式，不预测下次获盾。

## Task 2：接入、验收和文档

**Files:** 修改src/ui/BattleStats.tsx、README.md；新docs/reviews/2026-10-28-shield-sources.md。

- [x] 在BattleStats已展开分支接入shieldSources与ShieldSources，复用onSource；定向测试/typecheck及React/simplify自审通过。
- [x] 全量test/build并行，build后CHECK_STARTUP_BUILD=1启动边界通过，格式和git diff --check通过。
- [x] 隔离stage50自然开战暂停；验证桃反查、双向定位、筛选/排序/焦点、图鉴与换对象/普通切页、320/390截图与键盘，清理试玩和视口，正式页只读核对。
- [x] 更新README、验收文档和计划，说明自动与浏览器覆盖边界，新功能不提交不推送。

## 验证命令

```powershell
npx.cmd vitest run src/ui/shield-sources.test.tsx src/ui/shield-coverage.test.tsx src/ui/battle-stats.test.ts src/ui/aura-coverage.test.tsx src/ui/incoming-shields.test.tsx
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
