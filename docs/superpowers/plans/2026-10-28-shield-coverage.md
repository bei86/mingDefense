# 月音狐战斗施盾可达名单 Implementation Plan

> 用户持续授权自主实施与验收；本轮本人按步骤实施、自审，不派代理，不另提交新开发。

**Goal:** 暂停查看月音狐当前施盾可达的存活灵兽并准确跳转。

**Architecture:** 独立shieldCoverage只读投影复用heroRange/center/distance，ShieldCoverage负责默认收起名单；BattleStats仅在属性展开时接入，沿用onSource跳转和原生命周期。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-shield-coverage-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖与默认命令。

## Review Focus

1. 低阶狐可施盾，自身/其他狐/桃是候选，不能借用攻击光环的排除条件。
2. 多格灵兽按整体中心，射程天赋扩大施盾范围，精确边界沿实际shieldTarget。
3. 当前盾量/叠盾上限不影响范围名单，名单不是准备动作或下一目标预测。
4. 来源倒下、目标倒下、备战及缺ID不生成虚假入口；编号0和同名实例准确定位。
5. 图鉴返回保留展开，切对象收起；筛选中跳转清条件保留排序，窄屏按钮可读可键盘使用。

## Task 1：投影与名单

**Files:** 新src/ui/shield-coverage.ts、src/ui/ShieldCoverage.tsx、src/ui/shield-coverage.test.tsx。

**Interfaces:** shieldCoverage(battle:Combat|null,sourceId:number):ShieldCoverageModel|null；model含sourceId:number、alive:boolean、range:number、targets:{id,kind,rank,position}[]。ShieldCoverage({model,onSelect})接受nullable model与(id:number)=>void。

- [x] 写真实Combat测试，覆盖逐候选shieldTarget对照、精确范围、多格中心、range/低阶、自身/桃/狐、满盾/倒下/备战、排序副本及null，运行确认失败。
- [x] 实现只读函数：找狐→记录alive/range→存活范围过滤→行列编号排序→复制字段；不改引擎或原数组。
- [x] 实现默认收起名单和说明，SSR覆盖自身编号0、同名不同编号、可访问名称、死亡及非狐，不承诺下一目标或盾量。

## Task 2：接入与验收

**Files:** src/ui/BattleStats.tsx、README.md、新docs/reviews/2026-10-28-shield-coverage.md。

- [x] 在BattleStats已展开分支接入ShieldCoverage，onSelect复用onSource；定向测试和typecheck通过，React/simplify自审。
- [x] 全量test/build并行，build后CHECK_STARTUP_BUILD=1显式检查启动边界；格式及git diff --check通过。
- [x] 独立stage50试玩验证名单、筛选/排序中定位、图鉴返回、换对象重置、键盘、320/390截图与日志；复原视口并清理试玩，正式战役只读核对。
- [x] 更新README、验收文档和本计划，明确浏览器与自动测试覆盖边界，新开发留工作区。

## 验证命令

```powershell
npx.cmd vitest run src/ui/shield-coverage.test.tsx src/ui/battle-stats.test.ts src/ui/aura-coverage.test.tsx src/ui/incoming-shields.test.tsx
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
