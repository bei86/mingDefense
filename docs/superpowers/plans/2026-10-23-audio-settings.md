# 独立音量设置实施计划

**Goal:** 玩家能独立调整音效/音乐响度，设置刷新保留，暂停与战场行为保持一致。
**Architecture:** 音量偏好及惰性通道增益独立于模拟；GameAudio/GameMusic各自接线；纯React面板由App驱动。
**Tech Stack:** 现有TypeScript、React19、Web Audio、Vitest、Vite，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-23-audio-settings-design.md`

## 约束及审查重点

默认100保持既有音量；旧开关键不变，新键不进入战役档；不改v24/schema2、RNG、素材、默认命令。不增加声部上限/队列。按用户持续授权在本会话顺序实现，不使用子代理，新功能本轮不提交不推送。
重点覆盖：非法偏好不写回；零音量无节点且不自动开声；两路总线不串；暂停设置不推进战斗；部分节点创建失败释放。

## 任务

- [x] 新建`src/presentation/audio-volume.ts`与测试，百分比合法值0–100、默认100、独立键、有限输入钳制、阻止存储异常、惰性总线和平滑调整/释放。
  接口：`AudioVolume(key, storage)`；`value: number`、`set(value): void`、`output(context): GainNode`、`dispose(): void`。
- [x] 接入`game-audio.ts`/`game-music.ts`，提供`volume`/`setVolume(value)`和`setMusicVolume(value)`，零音量不生成声部；更新音频测试记录总线与包络，验证真实路径及故障清理。运行`npx.cmd vitest run src/presentation/audio-volume.test.ts src/presentation/game-audio.test.ts src/presentation/game-music.test.ts`。
- [x] 新建`src/ui/AudioSettings.tsx`与样式，App添加整备/暂停入口与模态焦点，保留快捷开关。滑杆`min=0 max=100 step=1`，标签及值关联，试听只在音效可用且开且非0时允许。运行typecheck与Prettier检查。
- [x] simplify检查本轮修改，完整`npm.cmd test`、`npm.cmd run build`、显式startup-build检查；game-playtest使用隔离端口真实交互，验证偏好刷新、320/390布局、暂停恢复、错误日志与截图。
- [x] 更新README和验收文档，关闭自己的验收标签/服务，最终Git空白检查与状态；交付中文总结及截图。
