# 烬灵鼠动作预览实施计划

**Goal:** 给已有角色动作样板提供开发版可暂停逐帧的检查入口。

**Architecture:** 启动时开发条件分流，在创建GameApp前载入独立页面。纯MousePreviewClock控制样板播放，Phaser场景复用ArtLayer，React只处理控件和变更后的帧号。当前会话继续原生实现，不创建子代理、不自动提交新改动。

**Tech Stack:** React、TypeScript、Phaser、Vitest。

**Spec:** docs/superpowers/specs/2026-11-04-mouse-motion-preview-design.md。

## Global Constraints

- 无新增依赖；不读取或写入战役、显示偏好、localStorage/sessionStorage。
- 不改真实战斗时钟、规则、攻击准备、投射物、RNG或存档。
- 仅开发版入口与懒加载；生产构建剔除整页和菜单入口，首包不带Phaser。
- 尊重系统减少动态，后台不补跑；预览一次动作不自动重复。

## Review Focus

1. 重伤末帧、重播后首帧、手动跳帧与计时游标必须一致。
2. 暂停/后台/减少动态之后不能累积旧时间；2倍速只影响预览时钟。
3. 嵌套路径、含旧playtest/perf/hash的入口重新构造干净地址。
4. 正确预览入口在App加载前分流；存储不可用也不影响预览。
5. 个别帧图缺失和StrictMode重新挂载时不隐藏错误、不泄露Phaser实例。

## Task 1: 纯播放状态和入口

Files: src/presentation/mouse-preview-clock.ts、mouse-preview-clock.test.ts、src/ui/motion-preview-route.ts、motion-preview-route.test.ts。

Interfaces: MousePreviewClock提供snapshot、advance(deltaMs,visible)、select(action)、toggle、replay、step(direction)、seek(frame)、setReduced(value)、speed。snapshot包含action/frame/count/playing/reduced/speed。

- [x] 编写一次动作末帧保持、待机循环、暂停跳帧、重播、2倍速、后台冻结、减少动态测试。先确认模块缺失失败。
- [x] 实现纯预览时钟；advance只接收当前帧delta，最大100ms，无Date/Storage/Session依赖。
- [x] motionPreviewRequested(search,development)严格匹配目标；motionPreviewUrl(pathname)只生成preview查询。测试嵌套路径与开发条件。

## Task 2: Phaser预览和控件

Files: src/render/MotionPreviewField.tsx、src/ui/MotionPreview.tsx、motion-preview.css、MotionPreview.test.tsx；修改Startup.tsx、PlaytestLauncher.tsx及相关测试。

- [x] 用独立场景加载四组帧图；绘制52px格与4倍对照，复用ArtLayer按width=42/height=36绘制，不逐帧调整尺寸。
- [x] React控件控制同一Clock对象，只有帧或控件状态变化才更新React；系统减少动态/失焦事件在卸载时清理。
- [x] 缺图直接标明缺失，提供重新加载；显示预览用途与实战验证边界。
- [x] 开发条件懒加载入口；菜单导航沿原pathname重建查询，返回正式与进入八灵链接不在渲染时执行。
- [x] SSR验证标签、加载提示、默认状态、存储禁用环境渲染无副作用；检查缺图与清理代码路径，实际加载失败及重复挂载仍待浏览器验证。

## Task 3: 验证与交付

Files: tools/startup-build.test.ts、README.md、docs/reviews/2026-11-04-mouse-motion-preview.md。

- [x] 生产构建检查页面/入口字样与模块全部剔除；首包边界仍通过。
- [x] 执行定向测试、typecheck、全量测试与构建；格式和diff检查。
- [x] 用game-playtest尝试连接浏览器，访问服务不可用，已记录具体阻塞与未验收项。
- [ ] 浏览器恢复后完成画布/交互截图、窄屏、缺图和StrictMode重复进出验收。
- [x] 按simplify与React实践自审；说明预览不等于真实攻击事件验收，新工作留待下一次提交。
