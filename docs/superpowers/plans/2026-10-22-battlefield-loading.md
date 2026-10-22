# 战场素材加载实施计划

**Goal:** 战场显示完成后才开战，缺图时可继续游玩并在整备重试。
**Architecture:** Battlefield监听Phaser加载进度及首次POST_RENDER；稳定回调通知App，App把就绪ref交给独立调度器；重试仅替换渲染实例。
**Tech Stack:** React19、TypeScript、Phaser3、Vitest；无新依赖。
**Spec:** ../specs/2026-10-22-battlefield-loading-design.md

## 全局约束

保留v24/schema2、原启动命令、数值、RNG及存档；仅当前代理直接实施，新功能留待用户下次提交。

## 重点检查

首帧前不开放输入；加载失败不无限等待；进度不等于成功张数；旧实例的异步回调不误报新实例就绪；重试不清档不吞撤销；暂停不被加载完成自动解除。

## 步骤

- [x] 扩展 `src/ui/game-loop.ts` 的可选第四参数 `canRun?: () => boolean`，每次advance之前判断，未就绪时调用 `clock.reset()` 并以0毫秒采样表现。测试真实Session运行30秒加载等待仍完整不变，放行后仅推进新时间；运行中冻结后不追帧；暂停仍保持。
- [x] 修改 `Battlefield.tsx`：本地 `{ready, completed, failed}` 状态与重试revision；preload注册progress、图片8秒超时/零自动重试；create统计缺失纹理，首次POST_RENDER才发送ready。清理disposed和全局监听。就绪前禁用棋盘，显示真实处理张数；缺图提示位于棋盘外，整备按钮重建渲染。
- [x] 修改 `App.tsx` 与 `PreparationPanel.tsx`：稳定 `onReadyChange` 同时更新ref与按钮状态、清除held并reset时钟；scheduler读取ref；onStart再次检查ref；加载时音乐不播放。普通UI更新不重建Phaser。
- [x] 新增加载样式，44像素重试按钮、窄屏换行。按React最佳实践和simplify复查本次新增部分。
- [x] 用独立生产副本与端口测试延迟图片、缺图及恢复后重试、阵容资源及查询参数保留，正常战斗和暂停；保存320/390及桌面截图。运行全量测试、build、启动依赖检查、Prettier、diff-check，更新README与验收记录。
