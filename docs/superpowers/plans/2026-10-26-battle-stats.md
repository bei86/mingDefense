# 暂停战斗当前属性实施计划

**Goal:** 暂停查看真实战斗中的当前行动参数及存活狐光环来源。
**Architecture:** battle-stats纯投影读取Combat；BattleStats默认收起，按实例key重置；BattleInspection组合新面板。
**Tech Stack:** React19、TypeScript、Vitest、现有CSS，无新增依赖。
**Spec:** `docs/superpowers/specs/2026-10-26-battle-stats-design.md`

## 约束与执行

用户已授权继续开发，当前会话顺序实现，不用子代理。不改战斗、存档、数值、随机、3格接敌及npm命令。本轮新功能不提交、不推送。

## Review Focus

- 狐倒下立即失去光环，低阶狐不提供，多个高阶狐不叠加。
- 战中天赋读取Combat，不以开战前整备覆盖。
- 暂停前boosted不能被当成恢复后的保证，展示两种间隔。
- 倒下灵兽不显示能继续行动；空战斗与缺ID安全。
- 窄屏与图鉴往返保留暂停、选择及展开状态。

## Task 1：真实属性投影

Files: 新建`src/ui/battle-stats.ts`、`src/ui/battle-stats.test.ts`。

- [x] 写失败测试并运行：鼠66命中对应真实攻击包，狐倒下变60；多狐、阶数与整体中心半径边界；战斗专属天赋；各攻击灵兽冷却对照真实stepCombat。
- [x] 实现`battleStats(battle:Combat|null,unitId:number):BattleStatsModel|null`，模型含kind/rank/position/alive/rows/auraSources。未知返回null，倒下rows为空；复制坐标。
- [x] 测试狐3.48%与真实施盾、桃6秒固定产钱、过量攻速上限、只读RNG不变；运行定向测试。

## Task 2：暂停面板

Files: 新建`src/ui/BattleStats.tsx`、`src/ui/battle-stats.css`，修改`BattleInspection.tsx`。

- [x] 默认收起details，展开时投影，双列表格有caption；倒下显示停止行动。按kind显示狐、桃及命中/光环说明。
- [x] 接入`<BattleStats key={unit.id} battle={session.battle} unitId={unit.id} />`；不增加effect、时钟或模拟写入。
- [x] 运行TypeScript与定向测试，按React/simplify审核范围内代码。

## Task 3：验收与记录

- [x] 全量test、build，构建后startup检查、Prettier及diff检查。
- [x] 隔离浏览器检查三类灵兽、默认收起、切换重置、图鉴往返及暂停；320/390宽截图，控制台检查。
- [x] README与review记录结果和局限，关闭自建页、恢复视口、停止自建服务；新功能留工作区。
