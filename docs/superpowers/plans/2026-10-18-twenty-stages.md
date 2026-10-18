# 第16–20关实施计划

**Goal:** 扩展至20关，接入霜咒祭司二阶段召唤强化。

**Architecture:** 独立50ms模拟，配置驱动首领，React HUD/Phaser薄渲染；只新增可选phase2SummonCount。

**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-18-twenty-stages-design.md`。

按本次用户授权在当前会话原生实施，不派生代理，不推送；已提交上一批56f1317，新批次保留工作区。

## Global Constraints

前15关与八灵/商店/天赋不变；新增参数P；每秒一只；180秒；20关为终点；兼容v2–v10先备份。

## Review Focus

- 半血恰逢召唤时本次用4只，半血非召唤时不得重置时钟或白送一波。
- 上限8只且按父实例计算，死亡不清已出生孩子，冻结不积压补召。
- 历史比较工具必须限定11–15，扩关不能把16–20赋为NaN。
- 旧15胜利档迁移只推进一次、只刷新一次，20失败回滚。
- 第20关窄屏名称、召唤强化提示与最终结算可见，DEV入口不能覆盖主档。

## Task 1: 配置与首领规则

- [x] 保留v10快照；JSON追加16–20与第四首领、v11和范围，content.ts按ID选择并描述二阶段召唤。
- [x] enemy-abilities.ts在已到召唤时钟的分支中使用 `boss.phase2 ? (skill.phase2SummonCount ?? skill.summonCount) : skill.summonCount`；不改定时器。
- [x] twenty-stages.test.ts覆盖配置前缀不变、连续波次、四首领隔离、二阶段时间边界/冻结/上限/死亡/斩杀/横扫。

## Task 2: 迁移与合法路线

- [x] persistence.ts加入v10；历史测试按关卡前缀回归，15完成改为可续16，新增20完成/失败/中止回滚。
- [x] 修正compare-late工具范围为slice(10,15)，旧检查点仅更新内容版本。
- [x] tools/export-twenty-stages.test.ts合法72路线，输出到场/胜利/时长/生命/分策略结果，导出16/20检查点；必要时仅调整新增参数并保留候选结果。
- [x] twenty-stages-simulation.test.ts验证三策略通关、逐兽统计/生命周期/检查点一致和前15结果不变。

## Task 3: 展示与验收

- [x] UI/页面标题改20关，霜咒祭司咒环/法杖，HUD二阶段强化提示，16/20DEV禁写入口。
- [x] npm test、npm run build、改动格式与git diff --check；生产JS无DEV入口。
- [x] game-playtest检查390/320尺寸、预警/二阶段/清场/结算截图；simplify复查。
- [x] README和docs/reviews/2026-10-18-twenty-stages.md记录最终数值、样本与实测边界。
