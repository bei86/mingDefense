# 暂停敌人排序 Implementation Plan

> 用户持续授权在本会话实施、自审和验收；不派代理，新开发留工作区。

**Goal:** 暂停时按当前生命或生命比例浏览敌人，保持具体实例与只读边界。

**Architecture:** enemy-sorting纯函数比较已有投影；selectEnemies过滤后复制排序，导出选择模型。EnemySelection受控显示种类/排序/名单，EnemyInspection保存事件状态并复用原导航。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-sorting-design.md

## Global Constraints

保持规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖、默认命令。

## Review Focus

1. 缺上限排有效比例之后，生命排序仍可用当前生命；非有限不变0。
2. 生命比例使用详情投影口径，不把向上取整值描述为原始浮点。
3. 非默认同值按编号，默认首领优先，源数组和统计不变。
4. 改排序保留编号，筛选失配选当前排序首只，来源跳转准确。
5. 档案保留排序，普通切页恢复默认，320长文案不横溢。

## Task 1：排序模型与测试

**Files:** 新增src/ui/enemy-sorting.ts、src/ui/enemy-sorting.test.tsx；修改src/ui/enemy-selection.ts。

**Interfaces:** sortEnemies(enemies, order)、enemySortLabel(enemy, order)；selectEnemies(view, kind, selectedId, order='default')返回含order的EnemySelectionModel。

- [x] 先写真实createCombat/spawnEnemy投影排序与只读测试，执行 `npx vitest run src/ui/enemy-sorting.test.tsx` 确认模块缺失失败。
- [x] 实现默认首领/编号、hp升序和health比例升序，缺失/非有限后排，同值编号；比例展示最多1位小数。selectEnemies过滤后复制排序，匹配编号保持，失配用排序首只，计数不变。
- [x] 运行新增和现有enemy-selection/enemy-inspection测试，验证比例与绝对HP相反、旧上限、null/空、同名、非法编号和全JSON只读。

## Task 2：受控控件与完整验收

**Files:** 新增src/ui/EnemySelection.tsx；修改src/ui/EnemyInspection.tsx、README.md；新增docs/reviews/2026-10-28-enemy-sorting.md。

- [x] 提取原种类/计数/名单为EnemySelection，追加受控44px排序；SSR核对默认兼容、生命比例/旧字段/准确编号。EnemyInspection的order本地状态参与selectEnemies与筛选；来源/衍生跳转不重置order，导航生命周期沿用。
- [x] React/simplify自审、定向测试/typecheck、全量测试、生产build、显式CHECK_STARTUP_BUILD=1启动依赖检查、Prettier与git diff --check。
- [x] Chrome隔离第50关自然暂停，核对生命/比例排序、同一实例保持、种类筛选、档案返回、普通切页、快捷入口、Tab、390/320截图及无横溢；恢复视口、关闭试玩，正式档只读核对。
- [x] 更新README和验收记录，计划勾选，本轮不再提交。
