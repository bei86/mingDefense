# 背景音乐实施计划

**Goal:** 用独立开关接入整备、守卫两段原创合成循环。
**Architecture:** GameMusic负责曲谱、节拍和声部；GameAudio复用音频上下文与手势解锁；App沿用展示更新和现有按钮位置。
**Tech Stack:** TypeScript、Web Audio、React、Vitest；无新增依赖。
**Spec:** ../specs/2026-10-22-background-music-design.md

## 全局约束

音乐默认关，独立偏好ming-defense:music；原有音效默认开。不得改v24/schema2、战斗RNG、原命令。按用户连续授权由当前代理直接实施，本轮新内容留待下次提交。

## 重点检查

音效关而音乐开仍可解锁；暂停开音乐不发声；异步resume后停播状态不得失效；后台/长卡顿不得补播；卸载和部分节点创建失败无残留。

## 实施步骤

- [x] 新增 `src/presentation/game-music.ts`：`MusicMood='prepare'|'combat'`、`musicMood(session)`、`GameMusic.update(context,mood)`、`stop(context)`、`dispose()`；六声部限制，短淡出，按音频时钟逐拍播放，不新增定时器。
- [x] 扩展 `src/presentation/game-audio.ts`：共享上下文、独立音乐偏好；`updateMusic(mood)`、`suspend()`；原有关键短音的stop不截断配乐；dispose同时清理音乐。
- [x] 新增 `game-music.test.ts` 并扩展 `game-audio.test.ts`，覆盖以上边界及真实Session的开战/暂停/选天赋/回整备状态映射。
- [x] 修改 `src/ui/App.tsx` 和 `feedback.css`，沿用展示循环与事件，按钮组在320/390宽度可换行且不遮挡棋盘；无重复状态同步effect。
- [x] 完成定向及全量测试、构建、格式和差异检查；按game-playtest检查Chrome并保存截图。按React最佳实践和simplify复查改动，更新README与验收文档，核对提交范围。
