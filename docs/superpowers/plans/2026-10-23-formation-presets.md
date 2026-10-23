# 阵型预设实施计划

**Goal:** 保存3套站位，在合法当前阵容上原子恢复并可撤销。
**Architecture:** 纯校验/匹配模块 + Session事务入口；独立版本化浏览器预设库与轻量hook；React对话框仅整备挂载。
**Tech Stack:** TypeScript、React19、Vitest、Vite，复用现有图片/焦点/存储接口。
**Spec:** `docs/superpowers/specs/2026-10-23-formation-presets-design.md`

## 约束

保持v24/schema2、随机流、资源及原有命令；不持久化实例拥有权，不改战役备份格式。新实现留待用户审阅，不推送。顺序完成，无子代理。

## 审查重点

满盘不能逐只移动而误判；种类相同但阶数数量不同不能套用；失败不得损失已有撤销；损坏库不能静默覆盖；开发隔离不能访问正常预设。

## 任务

- [x] `src/game/formation-presets.ts`：捕获/结构校验/当前阵容匹配，`Session.applyFormation`原子应用及针对性测试。
- [x] `src/ui/formation-preset-storage.ts`与hook：版本化3槽读写、错误保留、隔离内存、存储测试。
- [x] `FormationPresets.tsx`及样式：3槽、小棋盘、内部覆盖/删除确认，接入整备及焦点。
- [x] 按React最佳实践与simplify复查，完整测试、生产构建和启动依赖检查。
- [x] game-playtest浏览器实际保存/移动/应用/撤销/刷新/适配，异常存储有针对性单测，保存截图，更新README和验收记录。
