# 第11–15关实施计划

**Goal:** 扩展至15关可玩闭环，完成岩铠领主与兼容迁移。

**Architecture:** 沿用独立50ms确定性模拟、React菜单/HUD和Phaser薄渲染层。JSON为唯一数值源，首领通过bossId查表。

**Tech Stack:** TypeScript / React19 / Phaser3 / Vite7 / Vitest3，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-18-fifteen-stages-design.md`

按当前会话直接实施；不派生代理，不推送。用户要求的旧开发内容已提交458fdf3，新批次保留工作区供体验。

## Global Constraints

前十关、八灵、商店与天赋保持v9；新增数值P；连续每秒出怪；15关为终点；兼容v2–v9且备份先行。

## Review Focus

- 非首领关仍调用bossDefinition：保留原来的第一首领默认配置，未知bossId明确报错。
- 护甲不能遗漏弹道/残留伤害：集中在统一伤害结算验证。
- 冻结预警不能提前触发；父死撤销未释放技能但已召孩子存活。
- 旧10关胜利重载后不可重复领奖；11关刷新只执行一次。
- 窄屏11–15关序号和护甲提示不能溢出，开发入口禁止写正式存档。

## Task 1: 关卡和护甲规则

- [x] 保留v9 JSON快照；新增11–15关、第三Boss、v10内容版本及阶段范围。
- [x] content.ts按bossId解析首领，提供名称/技能说明；resolveHits支持首领damageReductionPercent，其他敌人不变。
- [x] fifteen-stages.test.ts验证快照不变、连续出怪、三个首领、护甲与易伤取整/实际伤害、冻结/召唤/半血/死亡。运行 `npx.cmd vitest run src/game/fifteen-stages.test.ts`。

## Task 2: 迁移与闭环

- [x] persistence.ts添加v9已知版本，persistence.test.ts覆盖v9整备/胜利档与写入失败。
- [x] ten-stages.test.ts保留前十关内容断言，改第10关为可续11；新测试覆盖15胜利完成、失败/中止回滚。
- [x] v9历史平衡测试改为快照对比；重生旧检查点的内容版本，不修改其阵容。

## Task 3: 合法经济校准

- [x] tools/export-fifteen-stages.test.ts跑72路线，输出各关到场/胜利/时长/剩余生命，导出11/15检查点。
- [x] fifteen-stages-simulation.test.ts检验每策略可通关、检查点/战报一致、前十关与既有结果相同。
- [x] 如新关不满足目标，仅调整11–15新增参数，记录候选及最终数值。

## Task 4: 显示与验收

- [x] App/CampaignPanels/index.html使用十五关文案、11–15序号、护甲HUD和第三Boss情报；Battlefield添加岩铠轮廓。
- [x] useSessionStorage添加11/15开发检查点，沿用禁写/失效隔离；检查生产包无入口/样本。
- [x] 运行npm test、npm run build、变更文件prettier和git diff --check；通过后不重复扩大测试。
- [x] game-playtest检查390/320宽度、准备/战斗/预警截图，记录实际通过及阻塞项；simplify复查新代码。
- [x] 更新README与docs/reviews/2026-10-18-fifteen-stages.md，汇报458fdf3及新批次工作区状态。
