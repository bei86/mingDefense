# 后续敌袭完整浏览 Implementation Plan

> 按用户持续授权在本会话顺序实施、自审、验收，不派代理；新开发留工作区。

**Goal:** 完整浏览未执行固定队列，并快捷查看其种类档案。

**Architecture:** upcomingEnemies(battle,page=0)派生8条分页与有效页；UpcomingEnemies仅保存页码，经BattleInspection复用onIntel与原挂起返回机制。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-upcoming-browser-design.md

## Global Constraints

保持规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖、默认命令。

## Review Focus

1. 页码超过最后一页、非有限及小数均安全归一，空队列无0/0导航。
2. 全50关分页index无漏/重，倒计时只取本场时钟，不重建队列。
3. 种类剩余数与档案本关总数不能混淆，候选实际队列沿用原入口。
4. 档案往返保留页码，普通切页重置，暂停不推进出怪。
5. 结束态与本页外数量准确，320翻页与种类按钮可用且无横溢。

## Task 1：分页模型

**Files:** 修改src/ui/upcoming-enemies.ts与src/ui/upcoming-enemies.test.ts；新增src/ui/upcoming-browser.test.tsx。

- [x] 先写失败测试：全50关未执行队列分页拼接、8/9边界、无效/超界页、游标变化、空/结束态和完整JSON只读。
- [x] 实现page/pageCount，8条切片从spawnIndex+page*8开始；hiddenCount表示所有本页外条目，保留默认首8只。

## Task 2：控件与完整验收

**Files:** 修改src/ui/UpcomingEnemies.tsx、src/ui/upcoming-enemies.css、src/ui/BattleInspection.tsx、README.md；新增docs/reviews/2026-10-28-upcoming-browser.md。

- [x] 添加受控分页列表控件以SSR覆盖首尾禁用、范围计数、结束/空态及可选档案按钮；本地pageState由容器维护。
- [x] onIntel从BattleInspection透传，复用完整实际spawns档案及原挂起机制；说明剩余/本关总数差异。
- [x] simplify与React自审，定向/typecheck、全量、build/显式启动依赖、Prettier与diff检查。
- [x] Chrome自然暂停翻页/键盘、档案往返保留页码、普通切页重置、继续至固定出完后无翻页，390/320截图；清理临时页、恢复视口并核对正式档。
- [x] README与验收记录、计划勾选；新开发留工作区。
