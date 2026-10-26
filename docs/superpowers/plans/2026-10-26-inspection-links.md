# 暂停双方锁定查看实施计划

**Goal:** 从灵兽定位锁定它的具体敌人，再从敌人返回其存活目标。
**Architecture:** 复用enemyInspection投影，BattleInspection持有双方选择与快捷焦点意图；AllyThreats折叠列表，EnemyInspection改为受控选择并提供目标回调。
**Tech Stack:** React19、TypeScript、Vitest、CSS，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-26-inspection-links-design.md`

## 全局约束

顺序执行，不用子代理；本轮不提交、不推送。不改战斗规则/数值、schema2/contentv24、随机流、3格接敌、依赖和原npm命令。

## Review Focus

- 同名敌人按ID进入详情，不能回落到首领或第一只。
- 死亡敌人不进列表，倒下/缺失目标无跳转，双方数量一致。
- 手动切页保留已选ID，快捷跳转覆盖目标选择；缺ID安全回退。
- 快捷跳转后的键盘焦点正确，普通页签不抢焦点。
- 全程暂停，320/390宽多条长名称无横向溢出。

## Task 1：投影契约与失败测试

Files: 修改`enemy-inspection.ts`，新建`inspection-links.test.ts`。

- [x] 新测试先失败：`enemiesTargeting(view,unitId)`从真实Combat投影筛选，逐兽数量等于targetedBy；同名和首领、死亡/缺目标、空输入与只读。
- [x] 导出`EnemyInspectionView`与`enemiesTargeting`，只过滤有效target ID，不重建Combat或预测攻击。

## Task 2：受控敌人选择与快捷入口

Files: 修改`BattleInspection.tsx`、`EnemyInspection.tsx`，新建`AllyThreats.tsx`、`inspection-links.css`。

- [x] 渲染测试先覆盖受控敌人第二实例、无效ID回退及目标按钮有无；AllyThreats默认收起和零目标不显示。
- [x] 父组件保存enemyId和快捷focusSide，普通页签清除焦点意图，双方跳转先校验ID再更新选择和页签。
- [x] EnemyInspection消费同一view/selectedId/onSelect/onTarget与autoFocus，不保存本地选择。目标按钮带名称阶数位置；无有效目标不显示。
- [x] AllyThreats只列传入的当前锁定敌人，按unit ID重置收起，展开后按钮列名称、ID、生命，最小44px高。
- [x] 定向测试与TypeScript，按React/simplify检查无重复选择状态、无effect和定时器。

## Task 3：验收

- [x] 全量test、build、构建后启动检查。
- [x] Edge隔离实战多敌锁定、指定非首只、双向往返、手动切页保留、无敌情况、焦点、暂停、320/390宽截图及控制台；生产只读恢复。
- [x] README和review、格式与diff检查；恢复视口、关闭自建页、停止服务，新开发留工作区。
