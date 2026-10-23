# 战后阵型复盘图实施计划

**Goal:** 把已记录的重伤批次映射到战后六乘六阵型图。
**Architecture:** 独立纯投影生成只读时点与单位状态，小型React组件挂在逐兽报告内，原生select只修改局部选择。
**Tech Stack:** TypeScript、React19、Vitest、CSS Grid、现有ArtImage。
**Spec:** `docs/superpowers/specs/2026-10-23-battle-formation-design.md`

## 约束与执行

用户授权提交并继续下一步，采用当前会话顺序实现；本轮新开发不提交，不推送。不改模拟/存档/规则/随机/依赖/原npm命令，不提供敌人或血量历史。

## Review Focus

- 旧数据缺时间线：只显示结束，不补全历史。
- 同批多兽：同时改变状态，不创造顺序。
- 多格灵兽：展示完整不透明占格，重伤不透底。
- 无效/过期时点键：回退结束而不崩溃；实际按新战报重建组件。
- 320像素与长名称：select/图/列表不溢出；正文可自然换行。

## Task 1：只读复盘投影

Files: 新建`src/ui/battle-formation.ts`及`battle-formation.test.ts`。

- [x] 先写并运行失败测试：真实双鼠失败记录、开战/首批/结束计数、同批、旧/空记录、未结束null、非法选择回退、完整占格和身份、胜利存档恢复及无副作用。
- [x] 定义`BattleFormationView`、`FormationMoment`与`FormationUnit`，实现`battleFormation(battle: Combat | null, pointKey: string): BattleFormationView | null`。状态为standing/fallen/newly-fallen，尺寸从实际英雄shape读取，标签含名称/阶数/锚点。
- [x] 运行定向测试与typecheck；验证输入JSON完全未变，旧记录只有end。

## Task 2：结算小图

Files: 新建`src/ui/BattleFormation.tsx`与`battle-formation.css`；修改`BattleReport.tsx`。

- [x] 组件默认收起，展开挂载内容；局部`useState('end')`，select的value取投影选中键，无效键自然回退。
- [x] 布局依次为时点select、人数、敌袭方向、完整六乘六静态图、图例、逐兽状态及观测说明。使用本地ArtImage及名称字形/阶数回退，不加入点击或拖拽行为。
- [x] 图的容器role=img提供当前状态名称；每块完整不透明，伤/新文字徽标和边框区分，文本列表作为完整可访问替代。
- [x] 仅在已结束的逐兽报告内接入，旧无report时也保留结束图；不影响原缺数据提示、时间线或导出。
- [x] 按React最佳实践及simplify检查状态边界、重复计算和CSS范围。

## Task 3：验收与交付

- [x] 定向与全量测试、生产构建、构建后启动检查、Prettier和Git空白检查。
- [x] game-playtest：隔离局真实开战到结算，切换时点及逐兽文本、窄屏、键盘、收起再展开，截图、控制台；生产只读启动恢复。
- [x] README和review记录证据及界限；恢复浏览器视口、关闭自建页、停自建服务，结果留在工作区。

