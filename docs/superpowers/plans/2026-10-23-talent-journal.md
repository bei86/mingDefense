# 天赋手札效果详情实施计划

**Goal:** 已选天赋可查询准确累计、层数上限和当前阵容适用范围。

**Architecture:** talent-effects共享格式/条件/战斗范围，talent-journal纯投影整备/战斗数据，BuffJournal独立呈现；不新增React状态或存储。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS。

**Spec:** `docs/superpowers/specs/2026-10-23-talent-journal-design.md`

## 执行与全局约束

依据连续开发授权在当前会话顺序实施，不另设确认、不启用子代理。新功能不提交、不推送。保持核心规则、参数、RNG、v24/schema2、素材、依赖、存档和默认命令。

## Review Focus

1. 满层和不在当前候选的天赋仍可查；未获得不出现。
2. 整备备战不计已部署；低于配置最低阶不算施放者。
3. 战斗选后成长必须从battle读取，不能读取开战前快照；倒下与备战分开。
4. 共享格式提取不得改变原三选一，浮点尾数、百分点与概率都需回归。
5. 多条内容在320宽不横溢，收起按钮键盘可达，关闭后战斗仍可推进。

## 任务1：只读效果模型

Files: 新`src/ui/talent-effects.ts`、`src/ui/talent-journal.ts`、`src/ui/talent-journal.test.ts`；改`src/ui/talent-preview.ts`。

- [x] 写测试并先确认缺模块失败；使用真实Session数据检查完整读取前后相同：

```ts
const before = JSON.stringify(session);
expect(talentJournal(session)).toHaveLength(1);
expect(JSON.stringify(session)).toBe(before);
```

- [x] 导出`talentContribution(id: BuffId, value: number): string`、`talentCondition(id: BuffId): string`、`talentBattleScope(battle: Combat, id: BuffId): string`，原预览调用这些函数。
- [x] 实现`talentJournal(session: Session): TalentJournalEntry[]`，包含id、level、maxLevel、contribution、scope、note；整备按Unit.position及配置种类/最低阶计数，战斗沿共享范围。
- [x] 对13种天赋、最后一层/满层、0层、乱序输入、只读、部署/备战/最低阶/倒下及战斗成长分别断言；运行新测试和原预览测试。

## 任务2：手札呈现

Files: 新`src/ui/BuffJournal.tsx`、`src/ui/talent-journal.css`；改`src/ui/CampaignPanels.tsx`、`src/ui/App.tsx`。

- [x] 拆出旧手札，保留原dialog标识、收起回调与App模态控制；名称图标、层数和详情语义分组，增加累计仅为单天赋贡献的说明。
- [x] 全部详情用渲染派生数据，无effect/memo/额外状态。限定CSS，去掉该列表内部滚动，只有弹窗滚动，文本和标题可换行。
- [x] 按React最佳实践与simplify复查；Prettier、全测试、build和显式startup-build通过。

## 任务3：验收记录

- [x] game-playtest浏览器实际整备、战斗查看与关闭；390/320长内容、键盘和截图、控制台。只使用正常UI/既有隔离检查点，不注入游戏状态。
- [x] README/review同步实际证据、覆盖边界，勾选计划。清理自己的服务器和标签；最终Git空白检查，新功能留工作区。
