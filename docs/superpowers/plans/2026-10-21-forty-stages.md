# 第36–40关实施计划

**Goal:** 扩展至40关，加入远程护甲首领玄甲咒尊及旧35关存档续关。

**Architecture:** JSON驱动50ms纯模拟，React负责情报/操作，Phaser只展示。复用全部现有战斗机制，不新增依赖、模拟或存档字段。

**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3。

**Spec:** `docs/superpowers/specs/2026-10-21-forty-stages-design.md`。

按用户继续开发授权原生执行，保留工作区供试玩，不自动提交或推送。

## Global Constraints

前35关完整配置保持v14；新增参数P；连续每秒一只、180秒、40终点；v2–v14先备份迁移；不调用生图。

## Review Focus

- 远程进2.2格才停，前排低阶/仇恨优先，清排后重新接近；冻结不能提前命中。
- 护甲与易伤乘算，免疫斩杀且不消耗其随机数；召唤上限10按父实例，剩两席只补两只。
- 半血不多召或重置时钟；父死留孩子，清场才胜利；冻结推迟横扫与召唤。
- 旧35继续36不重领奖或多刷招募；迁移备份/主档写入失败保留原档。
- 历史配置、检查点载荷与前35路线不变；320宽无溢出；DEV检查点禁写正式档且生产包排除。

## Task 1：配置、规则与存档

**Files:** 平衡JSON、v14快照、`content.ts`、`persistence.ts`、新`forty-stages.test.ts`及历史关卡测试。

- [x] 保存v14配置，追加36–40、eighthBoss和v15；内容映射增加名称。
- [x] 对移除eighthBoss且还原元数据/前35关的配置执行`toEqual(v14)`，验证全量前缀。
- [x] 用`createCombat(...,{stageId:40})`测试远射/前排、护甲/斩杀、冻结、14秒召唤/10上限/2空位/独立父实例、横扫/35%攻速和清场。
- [x] `loadSession`允许v14迁移；`won(35)`模拟旧完成档，检查备份、36入口、单次刷新和写入失败原档保留；`won(40)`检查终点/幂等/回滚。
- [x] 历史测试改为原长度前缀，35终点可继续36；历史fixtures只升内容版本。

## Task 2：校准与合法检查点

**Files:** `tools/compare-forty-stages.test.ts`、`tools/export-forty-stages.test.ts`、`src/game/forty-stages-simulation.test.ts`、36/40 fixtures。

- [x] 复用`simulate(seed,policy,boost,40,true)`生成72路线，比较只修改slice(35,40)和eighthBoss，finally恢复。
- [x] 选择三策略都有完整路线的候选，记录全部样本和前35回归结果；导出`checkpoints[35]`与`checkpoints[39]`。
- [x] 验证全部`validSave`、实际伤害合计/生命周期与击杀，36/40检查点精确复现。

## Task 3：展示、素材与验收

**Files:** `Battlefield.tsx`、`App.tsx`、`CampaignPanels.tsx`、`useSessionStorage.ts`、`index.html`、README、素材扩展提示词和验收记录。

- [x] 画深青护甲/双符冠/环杖轮廓，更新40终点及说明；添加stage36/stage40禁写DEV入口。
- [x] 单列40关两项完整提示词，缺图合计22，保留原58项/18缺项统计。
- [x] 全量测试、构建、改动文件格式/Git空白检查、生产JS无DEV标记；simplify内联检查保持配置与模拟分层。
- [x] 浏览器390/320宽检查入口、情报、开战/暂停/倍速，截图并记录实际动态验证范围；更新README和验收结果。

验收记录：[四十关原型验收](../../reviews/2026-10-21-forty-stages.md)。浏览器已验证入口、情报、开战与操作；慢帧下未完成手动全流程，具体限制与自动验证范围见记录。
