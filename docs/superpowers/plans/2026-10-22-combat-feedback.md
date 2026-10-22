# 战斗动效与基础音效实施计划

**Goal:** 利用现有立绘和本地合成短音完善战斗反馈。

**Architecture:** CombatFeedback在独立游戏循环后读取快照；Phaser消费pose和退场池，DOM显示首领提示。GameAudio只接收短音事件，负责用户手势解锁、节流、静音和资源释放。

**Tech Stack:** 现有React、Phaser、TypeScript、Vitest和浏览器Web Audio，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-combat-feedback-design.md`

## 约束与复核重点

当前会话原生执行，不派子代理、不自动提交；保留v22数值、规则、存档和运行命令。初始快照不播放旧事件；退场池有上限；暂停、冻结与减少动态效果不能继续晃动；静音/离屏立即停止旧声音；音频和存储失败不能影响战斗。

## 任务

- [x] 创建`src/presentation/combat-feedback.ts`及测试。接口`update(session, deltaMs, visible?)`返回短音事件，公开`time`、`notice`、`ghosts`及`pose(team,id,reducedMotion?)`。通过真实合成、伤害/护盾、阶段及胜负快照验证只读性、去重和回滚；运动幅度有界。召唤仍由既有FieldEffects处理，不重复发声。
- [x] 创建`src/presentation/game-audio.ts`及测试。接口`unlock()`、`play(cue)`、`stop()`、`dispose()`和`setEnabled(value)`；可注入AudioContext工厂及偏好存储。模拟失败恢复、静音取消、限流、并发与节点释放；真实Web Audio使用短音包络。
- [x] 修改`game-loop.ts`增加可选推进后回调，保持原模拟与HUD调度；在App绑定反馈、手势/失焦和卸载清理，整备/暂停菜单提供音效按钮；新增反馈HUD样式与减少动态效果规则。
- [x] 修改`Battlefield.tsx`消费演员变换和退场池；血条/占位/点击坐标不动，冻结不摇摆；沿用`ArtLayer.ts`既有变换复位及回归测试，无需修改图片池。
- [x] 针对性测试后执行全量测试及构建，使用simplify复核；390/320浏览器验证、截图，更新README和验收记录，列明音频听感与真机限制。

结果：347项测试通过、20项工具测试跳过，构建与格式检查通过；完整证据和浏览器验证边界见`docs/reviews/2026-10-22-combat-feedback.md`。保持未提交。
