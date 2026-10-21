# 整备与守卫界面分离实施计划

按用户“这个方案改”的授权，在当前会话原生执行并自行复查，不自动提交或推送。

**Goal:** 整备突出布阵，守卫突出战场，手机首屏保留生命、倒计时和聚灵操作。

**Architecture:** 同一Session与Battlefield持续挂载；React按阶段切换HUD与操作面板，Phaser仅按阶段切换底格绘制。复用暂停、确认、天赋及结算逻辑。

**Tech Stack:** React19、TypeScript、Phaser3、Vite7、Vitest3。

**Spec:** `docs/superpowers/specs/2026-10-21-preparation-combat-ui-design.md`。

## Global Constraints

不改模拟、数值、棋盘坐标、存档结构或依赖；整备多格占位保持不透明；不生成新素材。

## Review Focus

- 开始失败留在整备；开战/重试清理拖拽、滚回顶部；同一canvas跨阶段保留。
- 倒计时不得为负，波次描述不得误报清场，首领与横扫仍清晰。
- 暂停、天赋、确认、说明不能叠出两个活动弹窗；按住聚灵失焦/取消释放。
- 返回布阵确认仍回滚收益，取消后仍暂停；查看天赋后能回到暂停菜单。
- 390/320宽不溢出；存档异常战斗中仍可见；暂停菜单焦点闭环。

## Task 1：界面与交互

**Files:** 新建 `src/ui/CombatPanels.tsx`、`src/ui/combat.css`，修改 `src/ui/App.tsx`、`src/ui/useSessionStorage.ts`。

- [x] 抽取紧凑关卡/战斗状态、聚灵操作、暂停菜单和共用敌情；App保持单一战场挂载。
- [x] 战斗生命/剩余时间/波次替换整备资源块；普通提示只在整备，写入失败战斗中保留。
- [x] 次要操作放入暂停弹窗，复用原确认和回滚；切换阶段清理输入、滚动并转移焦点。
- [x] 聚灵保留捕获及释放事件；暂停禁用、键盘释放、查看天赋/帮助返回暂停。

## Task 2：战场展示

**Files:** `src/render/Battlefield.tsx`。

- [x] 只在整备绘制完整格框/未解锁点/不透明占位；战斗保留森林、角色、血条、预警与入口。
- [x] 只在整备挂载布阵输入按钮；不重建Phaser或改变坐标与纵横比。

## Task 3：验证与记录

**Files:** README、`docs/reviews/2026-10-21-preparation-combat-ui.md`。

- [x] 执行全量Vitest与生产构建，检查改动格式与Git空白。
- [x] 浏览器在禁写正式档的检查点验收普通/首领、320/390和桌面；截图对照整备与守卫。
- [x] 通过UI检查开战/暂停/倍速/返回确认/菜单天赋/按住释放，记录未能完成的动态流程。
- [x] 用simplify内联复查新增组件与阶段分支，更新使用说明及验收文档。

验收记录：[整备与守卫界面](../../reviews/2026-10-21-preparation-combat-ui.md)。手动通关、持续按住及切后台验收范围的限制已明确记录。
