# 岩甲豚剩余动作素材准备计划

**Goal:** 让用户能直接生成与现有攻击造型一致的三张动作帧图。

**Architecture:** 只读现有攻击条，导出精确参考和透明安全画布；按统一四足角色规范提供三段独立完整提示词。生产运行时保持现状。

**Tech Stack:** Python/Pillow、Markdown。

**Spec:** `docs/superpowers/specs/2026-11-06-boar-remaining-motions-preparation-design.md`

## 约束与检查重点

- 参考必须来自当前攻击首帧，不混用旧静态参考。
- 不缩放参考，RGBA回读一致；外围透明且主体完整。
- 源动画尺寸/哈希与处理记录不一致时拒绝导出。
- 受击末帧回到基准；重伤末帧伏卧保持，不自动站回或渐隐。
- 所有提示词可单独复制，不依赖“同上”，不含用户排除的词，不要求生图API。

## 任务

- [x] 新增`tools/prepare-boar-motion-reference.py`：读取条图与prepared/preparation.json，校验来源并取crop(0,0,384,288)，直接save PNG；paste到512×512的(64,112)，写来源报告。
- [x] 脚本内验证两张PNG回读像素、透明边缘，保护旧参考/原图/发布图哈希；运行并目视检查输出参考。
- [x] 创建`docs/art/2026-11-06-boar-remaining-animation-prompts-copy-ready.md`，包含4帧待机、3帧受击、5帧重伤三个完整代码块与保存路径；与四足、朝向及真实透明要求逐项自审。
- [x] 更新素材README、项目README与角色动作方案；运行相关素材/角色描述测试和diff检查，记录验证范围。本轮新准备工作留在工作区。

自审：交付仅为素材准备，不增加虚构帧或新运行时动作；实际接入、动作优先级和实机验收在收到三张原图后进行。
