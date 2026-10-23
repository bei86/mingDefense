# 灵兽战斗音色实施计划

**Goal:** 七种技能听觉可区分，满阵攻击声共享预算，不盖过关键提示。
**Architecture:** 独立音色/映射数据；CombatFeedback识别实际Flash；GameAudio调度、包络和资源保护；沿用原开关及共享AudioContext。
**Tech Stack:** TypeScript、React19既有界面、Web Audio、Vitest、Vite。
**Spec:** `docs/superpowers/specs/2026-10-23-combat-sound-design.md`

## 约束与审查

保留原命令、数值、v24/schema2、正式档及独立音乐偏好；不新增素材依赖/设置面板/队列。顺序执行，无子代理；本轮新实现不提交不推送。
关注敌方误映射、暂停旧声重播、多种音色绕过140ms、关键提示被攻击盖住、部分节点创建失败泄漏。

## 任务

- [x] 新建`sound-cues.ts`及`sound-palette.ts`；真实Flash映射/去重测试，GameAudio消费同一音色数据。
- [x] 新增共享战斗冷却、当前事件轮换、关键提示保护；测试静音/不可见/优先级/节点失败和释放。
- [x] 完整测试、构建、启动分包检查，simplify局部审查；生成同源WAV试听。
- [x] game-playtest开发隔离与生产包真实流程、适配/日志/截图，更新README及验收记录，停止临时服务。
