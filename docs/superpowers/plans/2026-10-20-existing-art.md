# 现有素材接入计划

按用户已认可的素材方向在当前工作区原生执行，不派生代理。

**Goal:** 用现有素材展示完整准备与战斗效果。

**Architecture:** 素材离线预处理生成静态清单，Phaser对象池读取既有模拟状态，React装饰图不参与交互与规则。

**Tech Stack:** Phaser3、React19、TypeScript、Vite；离线Python/Pillow，无新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-20-existing-art-design.md`。

## Global Constraints

原图、规则、存档、50ms时序、整块不透明占位与拖动命中保持；缺图有回退；不调用生图API、不推送。

## Review Focus

透明底噪点、不同长宽比、多格图遮住生命阶级、对象池重复创建、缺图加载失败、320宽控件、StrictMode场景销毁。

## Task 1: 素材准备

- [x] `tools/prepare-game-assets.py`裁边等比缩图、WebP与`src/render/art-manifest.json`，保留原图哈希报告。
- [x] `src/render/art.ts`统一路径、角色/敌人/首领映射，缺图明确回退。

## Task 2: 战场与DOM

- [x] `src/render/Battlefield.tsx`加载清单，用持久对象池绘制角色、背景和已有特效，保持占格/预警/交互覆盖层。
- [x] `src/ui/ArtImage.tsx`、准备面板、HUD与天赋接入装饰素材，CSS背景和九宫格边饰保持可读。

## Task 3: 验证

- [x] 规则测试、类型与生产构建、格式检查；确认资源与原图完整。
- [x] 实际浏览器准备/合成/拖动/开战/首领/暂停/手札，保存手机尺寸截图。
- [x] 记录动态验收边界：此次浏览器旧版对照也约 1–2 FPS，完整二阶段/三选一/结算待正常前台或真机补验，详见 `docs/reviews/2026-10-20-existing-art.md`。
- [x] simplify内联复查与README/验收记录；未派生代理，未改规则与存档。
