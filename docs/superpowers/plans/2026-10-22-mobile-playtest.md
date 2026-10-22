# 手机试玩版实施计划

**Goal:** 提供可访问、可检查、保留清晰度的手机试玩版本。

**Architecture:** 原有React交互层负责触控、弹窗和安全区，Phaser保持只读渲染。可选开发面板在渲染帧末统计有界指标，不接入战斗规则或存档。

**Tech Stack:** React 19、Phaser 3.90、Vite 7、TypeScript、Vitest；不新增依赖。

**Spec:** ../specs/2026-10-22-mobile-playtest-design.md

本会话直接执行；用户已批准开始，不自动提交、不启动子代理。

## 全局约束与检查重点

- 保留已有未提交开发、v22规则、全部四十关及原有npm命令。
- 图形采样仍为1–3倍；窄屏不通过整体缩放网页解决溢出。
- 副指针不得结束主指针拖动或聚灵，取消/失焦仍释放。
- 短屏和横屏允许滚动；模态内部可滚动且背景锁定。
- 性能数据只代表当前浏览器，不能替代真机；生产包不含调试面板。

## Task 1：访问与触控完善

- [x] package.json增加dev:lan和preview:lan，值分别为vite --host 0.0.0.0、vite preview --host 0.0.0.0 --strictPort。
- [x] App.tsx的drag记录增加pointerId，move/up/cancel按ID过滤，开始时过滤副指针与非左键。
- [x] CombatPanels.tsx聚灵过滤副指针和非左键，keyup只释放空格/回车。
- [x] useModalFocus.ts增加背景overflow锁定并恢复，保留焦点陷阱；mobile.css统一安全区和非棋盘触控区域。
- [x] 浏览器验证窄屏点击、部署合成、主指针拖动、暂停弹窗和键盘聚灵；真实多指行为记为待真机验证。

## Task 2：有界性能观测

- [x] 新增src/render/frame-metrics.ts和测试，最近120帧环形样本，可见页面长间隔保留，离屏清空窗口，输出fps/P95/超过50ms慢帧比例及绘制CPU耗时。
- [x] ArtLayer增加只读池计数；Battlefield.tsx在DEV且perf=1时采样、每秒更新独立DOM面板；隐藏页面时重置采样。
- [x] 测试覆盖60Hz稳定帧、慢帧、环形容量、长停顿与时钟回退；沿用ArtLayer回收用例验证池计数。
- [x] 第40关浏览器读取可见性能面板，记录场景、窗口与敌人数，按证据决定是否优化。

## Task 3：回归与交付

- [x] 独立5174端口运行局域网入口，确认本机与LAN地址HTTP响应；不修改系统防火墙。
- [x] 浏览器检查320/390宽和横屏、后期战斗、独立端口新局存档/刷新回退/下一关。
- [x] 运行完整npm test -- --maxWorkers=2、npm run build、格式和diff检查；预览包确认开发面板被排除。
- [x] README新增手机使用方法；docs/reviews/2026-10-22-mobile-playtest.md记录证据、已修复问题和真机剩余项。
