# 诊断报告记录画面设置实施计划

**Goal:** 性能报告完整记录画面选项，并隔离不同设置的采样窗口。

**Architecture:** 给现有PerformanceContext增加纯值display上下文；Battlefield统一从ref读取设置与系统状态，派生实际策略并用于绘制、采样和捕获。不新增产品面板。

**Tech Stack:** React19、TypeScript、Phaser3、Vitest、Vite、Chrome。

**Spec:** `docs/superpowers/specs/2026-10-27-performance-display-design.md`

按用户持续授权原生顺序执行、自审，不派代理、不重复审批，本轮不提交不推送。

## 约束与审查重点

- 不改contentv24/schema2、三格距离、规则数值、随机、存档、素材、依赖和npm命令。
- 设置改变后捕获须拒绝旧窗口；即使有效动态相同，选项来源变更也分窗。
- 系统优先复用displayEffects，诊断和实际绘制使用同一组输入。
- 性能捕获不读取存储、不修改Session；旧报告保留，不随新设置变化。
- 不把桌面采样称作手机性能，不增加生产DEV入口。

## Task 1：上下文与报告

文件：`src/render/performance-report.ts`、`performance-report.test.ts`。

- [x] `performanceContext(session: Session, options: DisplayOptions, systemReduced: boolean): PerformanceContext`新增display字段，含numbers、motion、systemReduced、reducedMotion。
- [x] 测试系统/用户四种组合、飘字独立、输入不变和无引用共享；用真实PerformanceWindow检查设置变化拒绝旧样本及首帧不计间隔。
- [x] 报告输出开关/用户选项/系统/有效动态，更新限制说明；测试全部组合及捕获文本稳定。

## Task 2：渲染接线

文件：`src/render/Battlefield.tsx`、`src/ui/App.tsx`。

- [x] Battlefield接收displayOptions和systemReduced；ref保存当前设置及displayEffects派生值，替代仅有效值的effects输入。
- [x] 采样和read捕获统一调用performanceContext(session, display.current.options, display.current.systemReduced)，更改选项不加入引擎effect依赖。
- [x] DEV读数增加一行飘字开关及有效动态；按React最佳实践和simplify自审。

## Task 3：验证与文档

- [x] 定向测试、全量测试、类型检查、生产构建与显式startup-build。
- [x] 按game-playtest浏览器检查设置前后报告、暂停返回、旧正文保留、390/320窄屏、控制台并保存截图，恢复视口。
- [x] 更新README、验收文档、计划状态；运行Prettier及diff检查，新增开发留工作区。
