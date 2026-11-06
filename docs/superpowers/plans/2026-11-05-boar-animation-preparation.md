# 岩甲豚攻击素材准备实施计划

**Goal:** 交付下一角色单张攻击帧图的直接生成资料，以及不会误发布素材的离线整理工具。

**Architecture:** 美术资料由已发布静态参考导出，生成与运行时隔离。纯Pillow函数先完成全部检查与内存切片，再将结果写到artifacts；不触及Phaser或Session。当前会话原生实施，不派生代理；新开发不自动提交。

**Tech Stack:** Python、Pillow、unittest；复用uv临时环境，不新增npm依赖。

**Spec:** docs/superpowers/specs/2026-11-05-boar-animation-preparation-design.md。

## Global Constraints

- 六帧一张生成，岩甲豚新图尚未收到，禁止标为生成或接入完成。
- 所有帧同一缩放、同一网格偏移，不独立裁紧，不写public，不改规则和存档。
- CLI输出限仓库artifacts下的新目录，禁止源文件覆盖；无效输入不留下处理结果。

## Review Focus

1. RGBA并不等于透明：拒绝无透明像素或角落不透明的帧图。
2. 跨格和裁切：逐格边缘可见内容、缩放后超边界都失败，不能静默截断。
3. 空帧和非整齐网格：拒绝错数、未填满或尺寸不能整除的网格。
4. 帧间运动：统一变换保持相对位移，合成测试包含标记证明没有逐帧重新居中。
5. 原图与已有输出：禁止覆盖任一已有输出目录，原图哈希保持一致。

## Task 1: 离线整理工具

Files: tools/prepare-animation-strip.py、tools/test_prepare_animation_strip.py。

- [x] 写合成输入测试并确认模块不存在时失败。
- [x] 实现`prepare_strip(source, output, *, columns, rows, frame_size, scale, offset=None)`；统一变换全部帧，输出前完成验证。
- [x] argparse提供显式网格、输出帧尺寸、共同scale和offset，不推断脚底，不重写原图。
- [x] CLI仅允许artifacts下的新输出目录；输出逐帧PNG、strip.webp、contact-sheet.png与report.json。
- [x] 执行11项unittest，确认非法透明、裁切、空帧、错误网格、覆盖与共同坐标行为。

## Task 2: 可复制生图资料

Files: docs/img/animations/boar/reference.png、reference-canvas.png、README.md；docs/art/2026-11-05-boar-attack-prompt-copy-ready.md。

- [x] 从发布WebP无损导出PNG并放入更大透明画布，保持原造型与像素；工具tools/prepare-boar-reference.py可重建。
- [x] 查看参考图，写3×2六帧提示词、上传和保存路径、单张生成说明与验收要点。
- [x] 核对PNG/WebP解码像素、透明与原文件哈希。

## Task 3: 状态及交付

Files: README.md、docs/superpowers/specs/2026-11-04-character-animation-design.md、docs/reviews/2026-11-05-boar-animation-preparation.md。

- [x] 记录工具验证和未收到新帧图的边界，说明后续实际接入步骤；docs/art/animation-strip-tool.md提供CLI操作说明。
- [x] 按simplify复核工具验证顺序和文件边界；运行diff检查与3项相关既有素材测试。
