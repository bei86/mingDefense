# 集中试玩入口实施计划

**Goal:** 从开发版界面选择现有隔离试玩场景和性能诊断。

**Architecture:** 纯场景目录及白名单URL构造，React弹窗只管理未提交的选择；App在DEV条件提供整备/暂停入口，导航复用现有loader。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome。

**Spec:** `docs/superpowers/specs/2026-10-27-playtest-launcher-design.md`

用户持续授权原生执行、自审，不重复审批、不派代理，本轮不提交不推送。

## 约束与审查重点

- 仅五个白名单目标，不改变loader、规则数值、contentv24/schema2、3格距离、fixture、存档、素材、依赖或npm命令。
- 选择和取消不导航；点“进入所选试玩”才离开，明确丢弃/导出提示。
- 保留部署pathname，移除旧case/variant/perf及hash；无效ID不能降级到正式档。
- 真实loader测试五个入口均isolated/blocked且零正式存储调用。
- 关闭仍暂停、控件44px、焦点循环、窄屏可用；生产JS无入口与说明。

## Task 1：白名单与隔离契约

文件：`src/ui/playtest-scenes.ts`、`playtest-scenes.test.ts`。

- [x] 定义playtestScenes五项目录（id、label、description、stage）与playtestUrl(id:string, diagnostics:boolean, pathname:string):string|null。
- [x] 测试所有URL导向真实loadBrowserSession，禁止storage读写并断言关卡与隔离；ranged8为默认原方案，roster为人工验收阵容。
- [x] 测试无效ID/查询注入拒绝、perf开关、子路径及新URL不继承旧查询hash。

## Task 2：菜单

文件：`src/ui/PlaytestLauncher.tsx`、`playtest-launcher.css`、`PlaytestLauncher.test.tsx`、`App.tsx`、`CombatPanels.tsx`。

- [x] 组件props含pathname、paused、onClose、onNavigate；默认首战/诊断开启，改选仅本地state，点击进入构造URL并调用onNavigate。
- [x] 添加说明、弃置及先导出提示、返回按钮；控件44px，唯一label与aria-describedby，沿用top-modal和useModalFocus。
- [x] App添加DEV整备/暂停入口、暂停菜单互斥与焦点context；onNavigate仅location.assign，关闭不改Session。
- [x] SSR验证默认值/文案/不调用动作；按React最佳实践和simplify自审。

## Task 3：验证记录

- [x] 启动构建测试新增DEV字符串排除，定向与全量测试、类型/生产构建、显式startup-build。
- [x] 用game-playtest检查五场景可选、选中不导航、取消、实际跨场景/诊断开关、暂停返回、390/320布局和截图、控制台；恢复视口。
- [x] README和验收文档，Prettier/diff检查，计划标完成；本轮留工作区。
