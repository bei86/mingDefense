# 后续敌袭查看实施计划

**Goal:** 暂停详情可查看剩余固定敌袭和接下来8只的游戏内时间。

**Architecture:** upcoming-enemies纯投影Combat队列与游标，UpcomingEnemies只负责呈现；BattleInspection新增第三个互斥页面，沿原暂停关闭流程。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-upcoming-enemies-design.md`

## 执行与全局约束

连续开发授权，本会话顺序实施、不启用子代理、不另设确认。保持连续出怪、3格接敌、前排/阶数/仇恨、全部数值与规则、RNG、v24/schema2、依赖、素材和默认启动命令。新功能不提交、不推送。

## Review Focus

1. 暂停在出怪时间点，必须以spawnIndex区分已出和未出，不能按at>time漏掉未执行项。
2. 同刻首领和杂兵保持原顺序，首领用当前关名称；旧队列缺kind按wolf。
3. 已生召唤/分裂、场上活敌不混入固定未出场统计，清空不等于胜利。
4. 详情读取不得改变时间、RNG、候选、队列、Session，暂停后重复读取完全一致。
5. 三个页签320宽仍可操作，多条队列可滚动，关闭后保持暂停；继续后游标正常前进。

## 任务1：队列投影与边界测试

Files: 新`src/ui/upcoming-enemies.ts`、`src/ui/upcoming-enemies.test.ts`。

- [x] 写失败测试，确认模块缺失失败。以真实50关createCombat生成队列核对总数/各类数及前8顺序。

```ts
const before = JSON.stringify(session);
const view = upcomingEnemies(session.battle);
expect(view!.remaining).toBe(session.battle!.spawns.length - session.battle!.spawnIndex);
expect(JSON.stringify(session)).toBe(before);
```

- [x] 实现`upcomingEnemies(battle: Combat | null): UpcomingEnemyView | null`，返回remaining、counts、next（index/kind/name/at/remainingMs/column）、hiddenCount和ended；截取前8条，不重新调用waveSpawns。
- [x] 实现`arrivalLabel(remainingMs: number): string`，0显示待出场，其余向上保留1位秒。覆盖游标/同刻/缺kind/衍生/清空/结束、50关、实际推进及完整只读对照。

## 任务2：暂停详情接入

Files: 新`src/ui/UpcomingEnemies.tsx`、`src/ui/upcoming-enemies.css`；改`src/ui/BattleInspection.tsx`、`src/ui/battle-inspection.css`。

- [x] 新组件呈现数量摘要、分种统计、前8列表、未展示余量，明确游戏内时间与固定/衍生范围。空队列不声明通关，结束状态不声明还会继续刷怪。
- [x] side联合类型增加upcoming，独立条件渲染，保留原两个页面内容。三列按钮44px高、文字可换行，限定CSS，不加React effect/memo/新状态。
- [x] React最佳实践及simplify复查；新模型测试、全测试、build、显式startup-build与格式/空白检查。

## 任务3：浏览器与交付

- [x] game-playtest开发隔离检查点正常开战/暂停、三页切换、队列读取冻结、关闭继续；390/320截图与滚动。正式生产包恢复存档后验证入口及内容，不注入游戏状态。
- [x] README和review记录实际证据与边界，勾选计划；关闭自己的标签、重置视口、停止自己的服务。保留新功能在工作区。
