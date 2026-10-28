# 战斗收尾提示 Implementation Plan

> 按用户持续授权原生顺序实施与自审，不另启代理；本轮新增开发留工作区。

**Goal:** 固定敌袭出完后明确仍在清敌或结算，避免提前暗示胜利。

**Architecture:** 纯函数 combatFinishStatus(battle: Combat|null): string|null 派生文案；CombatStatus 仅在 combat 阶段调用并渲染一行提示，无额外订阅或时钟。

**Tech Stack:** TypeScript、React19、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-combat-finish-status-design.md

## Global Constraints

保持规则、数值、RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式与容量、素材、依赖和默认命令。

## Review Focus

1. 已到出场时间但游标未消费不能显示出完；击退数超固定数也不能代替游标。
2. 召唤和分裂计入活敌，hp<=0不计；死亡实体不意味着已经胜利。
3. 四类残留招式分别阻止“等待判定”，不能遗漏其中一类。
4. 结束 battle.result 与非combat阶段分别隐藏，暂停和天赋选择不误隐藏。
5. 展示不改变Session、RNG或引擎收尾顺序，320宽度不横向溢出。

## Task 1：只读状态与回归

**Files:** 新增 src/ui/combat-finish-status.ts、src/ui/combat-finish-status.test.ts。

- [x] 编写测试并运行确认缺少模块而失败，覆盖上述五类边界及真实引擎收尾。
- [x] 实现前置guard；循环统计活敌，优先返回清敌文案，其后检查四种招式数组，最后返回等待判定。
- [x] 定向测试通过并检查投影前后JSON一致、暂停tick无推进。

## Task 2：HUD接入与验收

**Files:** 修改 src/ui/CombatPanels.tsx、src/ui/combat.css；新增 src/ui/combat-finish-status-ui.test.tsx；更新 README.md 和 docs/reviews/2026-10-28-combat-finish-status.md。

- [x] CombatStatus派生finishStatus，在combat-wave之后条件渲染p.combat-finish-status；CSS margin 6px 0 0、11px、1.6行高、薄荷色、允许换行。
- [x] SSR覆盖战斗/暂停/待选展示、未出完/胜败/prepare隐藏、渲染只读；执行React/simplify自审。
- [x] 定向、全量、构建、显式启动依赖检查、Prettier及diff检查。
- [x] 正常UI第50关独立自然试玩，390/320截图；暂停保持、结果页隐藏、正式档不推进。
- [x] 更新README与验收文档，记录实际结果与未覆盖边界。
