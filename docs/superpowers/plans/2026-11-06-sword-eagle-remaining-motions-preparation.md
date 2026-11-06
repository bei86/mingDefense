# 青锋隼剩余动作准备计划

目标：给用户一张来自当前攻击首帧的统一透明参考，以及待机/受击/重伤三段独立可复制提示词。

方案：docs/superpowers/specs/2026-11-06-sword-eagle-remaining-motions-preparation-design.md。

- [x] 新增tools/prepare-sword-eagle-motion-reference.py，验证已审核发布条与原图哈希，导出448×352首帧及512×512画布，保存来源报告；检查回读像素/外围透明/输入未变。
- [x] 运行并查看参考图，确认右前方朝向、羽尖/冠羽/尾羽/爪完整；没有假背景或截断。
- [x] 新增docs/art/2026-11-06-sword-eagle-remaining-animation-prompts-copy-ready.md，三段完整独立提示词：4帧2×2、3帧3×1、5帧5×1，明确悬停和重伤下降的区别、真实透明与保存名。
- [x] 更新素材README、主README、动作进度及准备记录；检查文本/路径/链接、素材相关测试和diff。按simplify复核新增离线工具，新工作保持待提交。

结果：新参考像素与攻击首帧一致，外围透明且全部输入未变；3段独立提示词与路径通过检查，7项素材测试通过。详见docs/reviews/2026-11-06-sword-eagle-remaining-motions-preparation.md。
