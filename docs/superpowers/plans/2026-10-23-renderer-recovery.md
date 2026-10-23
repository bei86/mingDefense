# 战场画面中断恢复实施计划

**Goal:** WebGL中断期间停止游戏，真实首帧后允许玩家继续。
**Architecture:** 独立生命周期监听器与单测，Battlefield绑定引擎事件，App负责暂停/清理输入，最高层React对话框负责提示和显式重载。
**Tech Stack:** TypeScript、Phaser3.90、React19、Vitest、Vite。
**Spec:** `docs/superpowers/specs/2026-10-23-renderer-recovery-design.md`

## 约束与审查重点

顺序实现不派代理；不改规则/v24/schema2、存档及默认命令；本轮新实现留待体验、不推送。
关注加载中丢失、Game假首帧、恢复又丢失、旧监听和回调、天赋/确认面板的焦点优先级。

## 任务

- [x] `src/render/renderer-recovery.ts`与测试：事件绑定/释放、场景就绪+真实首帧双门、恢复状态机；Session+Clock联测。
- [x] `Battlefield.tsx`接入加载及渲染就绪，`App.tsx`暂停与输入清理；`RendererRecovery.tsx`最高层提示、焦点优先、显式重载。
- [x] React最佳实践/simplify局部复查，针对性测试、完整测试、生产构建、启动分包检查。
- [x] game-playtest正常浏览器流程和窄屏截图；记录故障注入限制，更新README及验收文档，清理自己的验收服务。
