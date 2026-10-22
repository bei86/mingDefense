# 启动加载与失败恢复实施计划

**Goal:** 首次下载期间有明确画面，加载失败后可保留地址和存档重新进入。
**Architecture:** HTML提供不依赖脚本的兜底；Startup组件包含Suspense和错误边界；App保持原有初始化；Vite分离Phaser。
**Tech Stack:** React19、TypeScript、Vite7、现有Phaser3；无新依赖。
**Spec:** ../specs/2026-10-22-startup-recovery-design.md

## 全局约束

保留v24/schema2、原命令、规则、RNG、自动存档；不引入Service Worker、不伪造进度、不声称首包总量减少。按用户连续授权由当前代理直接实施，本轮新改动留待下次提交。

## 重点检查

入口脚本404时HTML和样式仍可见；App模块404进入错误状态；查询参数及原进度保留；StrictMode只沿用原初始化；错误重载必须重新请求而不复用失败的lazy Promise；短屏与减少动态效果可用。

## 步骤

- [x] 新增 `src/ui/Startup.tsx`：模块顶层 `lazy(() => import('./App').then(m => ({default:m.App})))`；`StartupBoundary`捕获加载/渲染异常；`StartupScreen`显示等待或失败文案和原地址重载链接。
- [x] 修改 `index.html`，为root添加可独立显示的加载内容和noscript提示，直接引用 `src/ui/startup.css`；修改 `main.tsx` 挂载Startup，保留StrictMode及其他CSS。
- [x] 新增 `startup.css`，提供森林配色、键盘焦点、44像素链接、窄屏和安全区及减少动态效果；不加载额外图片。
- [x] 修改 `vite.config.ts`，使用 `manualChunks` 和 `onlyExplicitManualChunks` 仅分离Phaser并开启构建manifest，保留server端口/strictPort；新增 `tools/startup-build.test.ts` 从manifest遍历静态依赖，确认异步边界和实际大小。
- [x] 使用独立生产副本及端口，验证App、Phaser和入口文件分别404、恢复后链接重载成功、查询参数/检查点保留。按game-playtest和前端调试技能记录正常游戏交互、桌面/320/390截图与预期故障日志。
- [x] 按React最佳实践和simplify复查；执行全量回归、生产构建、格式及差异检查，更新README与验收记录。另验证base=/ming/构建路径，测试副本63个正式文件已逐字节核对恢复。
