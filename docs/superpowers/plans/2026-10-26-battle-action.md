# 暂停灵兽行动状态实施计划

**Goal:** 在既有暂停属性中查看真实冷却、准备中的动作和桃产钱计时。

**Architecture:** `battle-action.ts` 只读投影；`BattleAction.tsx` 无状态展示；在 `BattleStats` 既有展开分支挂载，复用当前生命周期和主题。

**Tech Stack:** React 19、TypeScript、Vitest、Vite、CUA Edge。

**Spec:** `docs/superpowers/specs/2026-10-26-battle-action-design.md`

## 全局约束

不改模拟、数值、RNG、schema2/contentv24、存档、3格距离、依赖或原npm命令。由当前会话顺序实施、自审，不委派；本轮新开发留工作区供下一轮提交。

## 审查重点

1. 最后一个tick应显示就绪，而不是延后一帧。
2. 狐查己方目标，攻击型查敌方目标，双方ID可相同。
3. 目标倒下或退场后仍显示原动作及失效原因，不承诺命中。
4. 准备中的动作和冷却独立，已发出的攻击/持续效果不误算为准备。
5. 暂停、切换实例、图鉴往返和320宽不能串数据或自动恢复战斗。

## Task 1：投影与真实模拟对照

文件：新增 `src/ui/battle-action.ts`、`src/ui/battle-action.test.ts`。

- [x] 测试 `battleAction(null, 10) === null`、缺ID、已倒下返回空状态，比较clone前后保证只读。
- [x] 对真实鼠战斗step后，断言 `cooldownMs === Math.max(0, ally.cooldown - config.runtime.tickMs)`；推进到冷却末tick，断言就绪，再step后ordinal增长。
- [x] 对前摇的due当前/未来边界，对照step实际释放；写入同号敌我，验证狐目标名称来自己方，死目标和缺目标标失效。
- [x] 桃仅有incomeMs，未到期/到期与实际income增长一致；准备动作排序不改变输入数组，忽略敌方动作和已发出攻击。
- [x] 实现纯函数与类型：`BattleActionModel { alive; status; cooldownMs: number | null; incomeMs: number | null; pending: { ordinal; targetLabel; targetAlive; remainingMs }[] }`，用现有英雄配置、heroRange及中心距离。
- [x] 运行 `npx.cmd vitest run src/ui/battle-action.test.ts` 直到通过。

## Task 2：属性区接入与展示

文件：新增 `src/ui/BattleAction.tsx`，修改 `src/ui/BattleStats.tsx`、`src/ui/battle-stats.css`。

- [x] `BattleAction({battle, unitId})` 读取投影，alive分支显示状态、倒计时和准备列表；标题「当前行动状态」，列表名称「准备中的动作」。
- [x] 在BattleStats存活分支表格后挂载，summary副标题加「行动状态」。冷却和准备列表分开；为0时「已就绪」/「待释放」/「待产钱」。
- [x] SSR测试有效/失效目标、狐和桃差异、倒下空态、默认收起的BattleStats不包含内部行动详情。
- [x] CSS限定属性区：小标题、冷却说明、动作列表深绿底、数值金色、长名称换行。
- [x] 运行定向测试和typecheck；按React与simplify检查，无派生state/effect/新计时器。

## Task 3：完整验收与文档

文件：修改README，新增 `docs/reviews/2026-10-26-battle-action.md`。

- [x] 全量 `npm.cmd test`、`npm.cmd run build`；构建后 `CHECK_STARTUP_BUILD=1` 运行startup-build检查。
- [x] dev独立boss场景实际查看攻击/狐/桃、切换默认收起、图鉴往返、暂停时间不动及继续后更新；390/320视口截图并检查溢出和控制台。
- [x] 写验收结果与实证局限，勾选计划，Prettier及Git空白检查；关闭自建页与服务。
