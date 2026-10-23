# 战报重伤时间线实施计划

> 采用当前会话原生顺序执行；用户已授权提交上一轮并继续开发，本轮结果留待下次提交。

**Goal:** 战后可查看每批重伤灵兽及其游戏内时间。
**Architecture:** 模拟器在步末观测一次，新增可选报告字段；展示与导出共享纯文本投影；存档校验可选新字段。
**Tech Stack:** TypeScript、React 19、Vitest、Vite。
**Spec:** `docs/superpowers/specs/2026-10-23-fall-timeline-design.md`

## 约束与检查重点

不新增依赖，不改数值/RNG/仇恨/出怪/3格距离，不升级存档版本，不改原npm命令。本轮不提交或推送新开发。旧报告不是无重伤；同帧不推断先后；倍速不改变模拟时间语义；最终全灭也必须记录；胜利恢复不丢数据或再次结算。

## Task 1：模拟记录与兼容校验

Files: `src/game/combat-model.ts`, `battle-report.ts`, `combat.ts`, `persistence.ts`；测试 `battle-report.test.ts`, `persistence.test.ts`。

- [x] 编写并先运行失败测试：真实致命普攻/同帧多兽/后续步骤不重复/首领横扫/互杀；护盾不误判；旧字段缺失不回填；重试清空；完整模拟去除report后对照一致。
- [x] 定义 `falls?: { at: number; unitIds: number[] }[]`，在createCombat初始化，在stepCombat的时间推进后调用只读生命观测并追加报告。
- [x] 在validSave的report验证内添加可选字段的严格校验；测试新胜利报告往返、缺字段兼容、空批次/重复ID/错误成员/漏记/越界/逆序拒绝。
- [x] 运行针对测试与typecheck，修复发现。

## Task 2：逐兽界面与文本导出

Files: 新增 `src/ui/fall-timeline.ts`, `fall-timeline.test.ts`, `fall-timeline.css`；修改 `BattleReport.tsx`, `battle-report-export.ts`, `battle-report-export.test.ts`。

- [x] 编写并先运行失败测试：旧记录null、新空记录空列表、同帧多个同种实例按位置识别；纯读取无副作用；真实失败报告含时间线；胜利恢复导出一致。
- [x] `fallTimeline(battle: Combat): string[] | null` 共用投影，时间显示两位小数，列行从1计数。
- [x] 逐兽折叠区加入标题和时间线列表，提供空/旧提示和50ms同批说明；长名称自然换行，不加新主按钮。
- [x] Markdown增加同语义章节，原收藏/备份自动保留全文；验证现有收藏/备份往返测试。

## Task 3：验证与文档

- [x] 运行全量 `npm.cmd test`、`npm.cmd run build`、`CHECK_STARTUP_BUILD=1` 启动构建检查。
- [x] 按simplify审视新增逻辑，修正重复和不必要分支；Prettier和diff检查。
- [x] 使用隔离试玩实际完成战斗，展开逐兽与导出，校验模拟时间/分组/窄屏布局，截图及控制台检查；关闭自建浏览器页和服务器。
- [x] README与验收文档记录实际结果、截图位置和未覆盖项。

