# 暂停月音狐光环覆盖 Implementation Plan

> 用户授权本会话直接实施、自审、验收；不派代理，新开发留工作区。

**Goal:** 月音狐显示当前攻击受益者名单并准确定位伙伴。

**Architecture:** battleStats 共用 auraCovers(fox:Ally, target:Ally) 派生原 auraSources 和新增 auraTargets。AuraCoverage 接收完整 model 与 onSelect，原生details折叠名单；BattleStats沿用 onSource/showAlly 回调。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-aura-coverage-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖和默认命令。

## Review Focus

1. 多格整体中心精确边界、天赋不扩固定半径，与真实命中一致。
2. 低阶/倒下狐与无伙伴分别说明，目标桃/狐/倒下者排除。
3. 同阶不同编号、0编号、站位排序、坐标副本和完整Combat只读。
4. 清筛选、保留排序、图鉴往返、键盘焦点和暂停状态。
5. 默认收起避免长名单撑开；390/320文本与44px触控可用。

## Task 1：只读覆盖模型与名单

**Files:** 修改src/ui/battle-stats.ts、src/ui/BattleStats.tsx、src/ui/battle-stats.css；新增src/ui/AuraCoverage.tsx、src/ui/aura-coverage.test.tsx。

**Interface:** BattleStatsModel新增 auraTargets:{id:number;kind:HeroId;rank:number;position:Point}[]；AuraCoverage({model:BattleStatsModel,onSelect:(id:number)=>void})。

- [x] 新增真实Combat覆盖/真实attackDamage比较、存活阶数/半径/多格边界/重叠/只读测试和SSR状态/同名编号测试，运行 `npx.cmd vitest run src/ui/aura-coverage.test.tsx` 确认先失败。
- [x] 抽取私有 `auraCovers`，原来源 `.filter(unit => auraCovers(unit, ally))`；狐分支派生targets，按y/x/id排序并复制坐标，不修改输入。
- [x] AuraCoverage仅狐显示：倒下/低阶/零伙伴显示状态；非空原生details默认收起，按钮 `onClick={() => onSelect(target.id)}`，复用既有来源按钮样式。BattleStats在model内容末尾接入，沿用onSource。
- [x] 定向模型/来源/选择/导航测试与typecheck通过。

## Task 2：验收与记录

**Files:** README.md、docs/reviews/2026-10-28-aura-coverage.md。

- [x] React/simplify自审，全量测试、build、显式CHECK_STARTUP_BUILD=1启动检查、Prettier及git diff --check。
- [x] Edge自然第50关暂停，筛狐/排序，覆盖名单定位同阶伙伴、来源回到狐、图鉴往返、Tab/Enter/Space；390/320截图目视核对，Chrome正式档只读，恢复视口并关闭试玩。
- [x] 完成README与验收记录，计划勾选，新开发留待下次提交。
