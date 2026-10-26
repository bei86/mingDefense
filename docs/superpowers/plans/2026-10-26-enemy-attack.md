# 暂停敌人普攻状态实施计划

**Goal:** 查看敌人的接近/冷却/冻结状态与真实准备攻击目标，并快捷定位存活受击灵兽。

**Architecture:** `enemy-attack.ts` 提供纯投影，enemyInspection附入每个活敌视图；`EnemyAttack.tsx` 按敌人ID重置折叠，仅展开渲染内容，跳转复用onTarget。

**Tech Stack:** React19、TypeScript、Vitest、Vite、CUA Edge。

**Spec:** `docs/superpowers/specs/2026-10-26-enemy-attack-design.md`

## 全局约束

不改战斗模拟、规则/数值、RNG、schema2/contentv24、3格接敌、存档、依赖、素材和原npm命令。按当前授权由主会话顺序实施、自审，不委派；本轮新增留工作区供下轮提交。

## 审查重点

1. 多格灵兽接触距离必须和combat一致，首领/远程使用各自射程。
2. 最后一个tick就绪；冻结时冷却和准备不递减，不将0秒误显示为马上释放。
3. 准备目标可能不同于缓存目标，双方同号不误读。
4. 失效目标仅列记录，无跳转；源死亡或缺失不显示行动。
5. 切换同名敌人重置折叠，目标跳转聚焦对应灵兽，320宽无溢出。

## Task 1：只读模型及模拟对照

文件：新增 `src/ui/enemy-attack.ts` 和 `src/ui/enemy-attack.test.ts`；修改 `src/ui/enemy-inspection.ts`。

- [x] 测试先调用 `enemyAttack(battle, id)`，真实step排入普攻后检查pending目标和due-time；推进至due验证承伤，推进至cooldown<=tick验证下一步再次排入动作。
- [x] 测试修改enemy.target但保留准备动作，真实step仍伤害原准备目标；准备列表按due/target排序、不混入己方同source动作或其他敌人的动作。
- [x] 测试冻结3个tick后cooldown和remainingMs不变，解冻后恢复递减；用contact定位多格边界及1e-9容差，参数化普通/远程/首领。
- [x] 实现 `EnemyAttackModel {status; frozenMs; cooldownMs; pending:{remainingMs; targetId; target; targetAlive}[]}`，null/死亡安全，target复制position，clone前后对比只读。
- [x] `InspectedEnemy` 增加 `attack: EnemyAttackModel | null`；每个活敌调用纯投影。运行定向测试及既有enemy-inspection测试。

## Task 2：详情展开与跳转

文件：新增 `src/ui/EnemyAttack.tsx`、`src/ui/enemy-attack.css`；修改 `src/ui/EnemyInspection.tsx`。

- [x] `EnemyAttack({model, onTarget})` 默认收起、展开才渲染状态与队列。准备动作存活目标使用既有inspection-link，失效目标没有按钮；冻结0秒「待解冻」。
- [x] 敌人详情内在横扫区前插入 `<EnemyAttack key={enemy.id} model={enemy.attack} onTarget={onTarget} />`，不改父级选择/聚焦逻辑。
- [x] 用导出内容组件SSR验证准备目标标签、冻结/空态、无失效跳转，及整个EnemyInspection默认无内部列表；CSS限定本区，44px按钮，窄屏换行。
- [x] 定向tests、typecheck；按React/simplify检查无新effect/计时器或重复选择状态。

## Task 3：验收与交付

文件：README及 `docs/reviews/2026-10-26-enemy-attack.md`。

- [x] 全量test、build、构建后显式CHECK_STARTUP_BUILD检查。
- [x] Edge独立boss试玩：查看接近、冷却或准备动作，切换实例收起、准备目标跳转及焦点；暂停时间保持、继续后更新；390/320截图和控制台。冻结边界以真实Combat测试对照，浏览器如遇到则补实证。
- [x] 生产只读恢复与启动检查；写实际结果及局限，勾选计划，Prettier及Git空白检查，清理自建页/服务并恢复视口。
