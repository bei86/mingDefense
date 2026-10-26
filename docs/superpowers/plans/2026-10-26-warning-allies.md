# 首领预警波及名单实施计划

**Goal:** 暂停敌人详情可展开每条已出现预警的当前行内存活灵兽，并点选查看。
**Architecture:** enemyInspection为warning派生allies，EnemyWarnings读取投影，复用现有onTarget跳转。原生details独立折叠，以敌人ID重置。
**Tech Stack:** React19、TypeScript、Vitest、CSS，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-26-warning-allies-design.md`

## 全局约束

用户持续授权自主下一步，当前会话顺序执行，不派代理。本轮不提交不推送。不改规则数值、schema2/contentv24、3格接敌、随机流、正式进度、素材、依赖和npm命令。

## Review Focus

- 多格锚点不在预警行也应入列，同一行多格只列一次。
- 依据存活与占格，不混用缓存锁定；同名实例按ID准确跳转。
- 主预警和回响独立展开，切换敌人重置；无预警和空行明确说明。
- 当前名单与实际释放后的受伤者区别说明，冻结不假定固定释放时刻。
- 深层名单按钮不受通用modal/list样式影响，320/390宽可读且不溢出。

## Task 1：只读投影与语义验证

Files: `src/ui/enemy-inspection.ts`、`src/ui/enemy-inspection.test.ts`、新建`src/ui/warning-allies.test.ts`。

- [x] 测试先失败：多格跨行、同名实例、死亡/备战、空行、源数组顺序与位置副本；真实stepCombat横扫前名单等于释放后受伤ID，冻结/回响仍读取现有状态。
- [x] 导出InspectedWarning，添加allies字段；筛选为hp>0且shape.some(([,dy])=>position.y+dy===warning.row)，按行/列/ID排序，位置复制，不推进模拟。
- [x] 原有精确warning断言增加预期allies，保留行号、时间和回响断言。

## Task 2：预警区与跳转

Files: 新建`src/ui/EnemyWarnings.tsx`、`src/ui/enemy-warnings.css`，修改`src/ui/EnemyInspection.tsx`。

- [x] 渲染测试覆盖行号、时间、回响、默认收起、实例入口、无预警与空行安全，使用真实投影。
- [x] EnemyWarnings接收readonly InspectedWarning[]和onSelect(id)，有名单用原生details默认关闭、无名单直接说明，说明当前占格不保证未来受击。
- [x] EnemyInspection替换原预警区为key={enemy.id}的EnemyWarnings，继续传onTarget；按钮标签含名称、阶数、编号和位置，min-height44px。
- [x] 定向测试、TypeScript；按React/simplify复查无冗余状态及样式覆盖。

## Task 3：完整验收与交付

- [x] 全量test、build及CHECK_STARTUP_BUILD=1检查。
- [x] Edge隔离首领实战已有预警展开、实例跳转、焦点、暂停时钟、敌人切换重置；320/390宽截图与控制台；生产只读恢复。
- [x] README和review、Prettier与diff检查，勾计划；恢复视口、关闭自建页面和服务，新功能留工作区。
