# 敌人当前战斗属性 Implementation Plan

> 按持续授权顺序实施和自审，不另启代理。本轮新增开发留工作区。

**Goal:** 暂停中查看所选敌人的当前普攻、动作间隔和移动参数，区分配置基础值与实例状态。

**Architecture:** 新增enemy-battle-stats纯投影，经enemyInspection附到实例，EnemyBattleStats复用battle-stats样式默认收起；折叠组件按实例编号设置key，切换时重置。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-battle-stats-design.md

## Global Constraints

保持战斗规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式与容量、素材、依赖、默认命令。

## Review Focus

1. 真实释放取整与狼狂暴边界，衍生狼和缺kind不误套加成。
2. 首领残血但尚未切阶段不能提前加速，阶段缺失明确说明。
3. 冻结不显示正在移动，减速叠加封顶及到期一致。
4. 切实例重收起；档案往返保留展开、筛选、编号和暂停。
5. 窄屏无横溢，纯投影不改变完整战斗或随机数。

## Task 1：只读投影

**Files:** 新增src/ui/enemy-battle-stats.ts及.test.tsx；修改src/ui/enemy-inspection.ts。

- [x] 写真实引擎对照的失败测试，涵盖九种普攻、狂暴边界/上限/旧字段、首领加速、减速位移和只读。
- [x] 实现纯投影并挂接enemyInspection；定向测试通过。

## Task 2：面板与验收

**Files:** 新增src/ui/EnemyBattleStats.tsx；修改src/ui/EnemyInspection.tsx、README.md；新增docs/reviews/2026-10-28-enemy-battle-stats.md。

- [x] 默认折叠，展开显示基础/当前普攻、间隔、射程、移速、减速、狂暴和边界说明；复用原表格样式。
- [x] SSR覆盖默认/展开/旧字段/冻结，回归敌人选择、预警与档案。
- [x] React/simplify自审，typecheck、全量测试、build、显式启动检查、Prettier与diff检查。
- [x] Chrome独立第50关自然UI核对狼/首领、实例切换与档案往返、390/320截图；清理临时页并核对正式进度。
- [x] 更新README与验收记录、勾计划，新开发留工作区。
