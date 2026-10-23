# 暂停敌人详情实施计划

**Goal:** 在现有暂停详情内查看当前活敌状态和已存在的横扫预警。

**Architecture:** 纯读取模型映射Combat实例，独立敌人详情组件管理选择；原BattleInspection增加阵营切换，默认灵兽，不改游戏循环。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS和美术，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-enemy-inspection-design.md`

## 约束与执行

沿用当前用户连续开发授权自主顺序实现，不派子代理、不重复确认。本轮不提交不推送；战斗规则、v24/schema2、RNG、默认命令、依赖及素材不变。模型不得调用tick、命令、随机或存储。

## Review Focus

缓存锁定的已倒下/未知目标不能冒充有效目标。旧maxHp或状态值缺失必须注明，0与缺失区分。无活敌不能显示上次实例。冻结可推迟预警，不称准确下一击。只统计当前活着且owner匹配的直属衍生，不混同其他召唤者。

## 任务1：只读模型与真实战斗对照

**Files:** 新`src/ui/enemy-inspection.ts`、`src/ui/enemy-inspection.test.ts`。

**Interface:** `enemyInspection(battle: Combat | null)`返回`{enemies: InspectedEnemy[], initialId?: number}`或null。每只返回值副本，不传出原敌人/坐标引用。包含id/kind/name/hp/maxHp/target/effects/warnings/origin/descendants/phase。

- [x] 写测试确认缺模块失败；真实Session开战后推进至已有敌人锁定，再暂停，投影对照记录，tick不改变状态。

```ts
const before = JSON.stringify(session);
const view = enemyInspection(session.battle)!;
session.tick();
expect(enemyInspection(session.battle)).toEqual(view);
expect(JSON.stringify(session)).toBe(before);
```

- [x] 实现纯投影。过滤hp>0、首领/ID稳定排序；锁定只接受存活目标，缓存已倒下/未知目标分开说明；缺maxHp显示null；状态以battle.time判断有效，余时向上保留0.1秒。
- [x] 对照同种不同ID、默认wolf旧kind、无/死敌、首领优先及阶段、字段缺失、状态边界、预警source/row/echo/排序、召唤来源和父怪退场、直属活衍生及无副作用。运行新测试和typecheck。

## 任务2：接入现有暂停详情

**Files:** 新`src/ui/EnemyInspection.tsx`；修改`src/ui/BattleInspection.tsx`、`src/ui/battle-inspection.css`。

- [x] 增加原生按钮分组「查看阵营」，aria-pressed表达选中，默认灵兽。敌人分支按需挂载，新组件原生select带明确标签；无活敌显示status。
- [x] 单敌显示生命、阶段、当前锁定、有效状态、来源与衍生、已有预警列表，注明缓存与冻结推迟限制。缺生命上限不用伪造进度条。关闭沿用原回调，不自行继续或改战斗。
- [x] 按React最佳实践和simplify复查；Prettier/typecheck，新旧详情测试、完整test、build及显式startup-build检查。

## 任务3：浏览器与交付

- [x] game-playtest独立开发端口合法首战：暂停、详情、阵营切换、实例选择、关闭仍暂停和主动继续。既有首领隔离场景检查首领身份和两阶段；实际预警窗口未捕获，预警以自动测试验证，边界记入验收，不注入内部状态。
- [x] 390/320真实尺寸下检查弹窗、焦点、滚动，截图并查控制台；独立生产端口正常恢复及新入口检查。
- [x] 更新README与`docs/reviews/2026-10-23-enemy-inspection.md`，恢复临时视口、关闭自己的标签、停止自己的服务，Git空白检查，本轮留待体验。

