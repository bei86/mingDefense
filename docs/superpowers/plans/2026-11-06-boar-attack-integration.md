# 岩甲豚攻击动作接入计划

**Goal:** 将用户生成的六帧攻击接入真实岩甲豚攻击事件。

**Architecture:** 离线固定比例与脚底校正；通用只读六帧攻击投影；Phaser统一动画清单加载与图片池绘制。

**Tech Stack:** Pillow、TypeScript、Vitest、Phaser 3、Vite。

**Spec:** `docs/superpowers/specs/2026-11-06-boar-attack-integration-design.md`

## 约束与检查重点

- 不改模拟规则，不调用生图API；原图保留且哈希不变。
- 统一缩放，不横向逐帧居中；脚底纵向平移可追溯。
- 编号0、多个岩甲豚、跨种类Flash隔离。
- 目标死亡取消前摇不能假放招；自身死亡、结算、换战斗复位。
- 暂停、选天赋、后台、倍速、减少动态效果跟随既有语义。
- 缺纹理回退静态；图片池原点不能污染其他角色。

## 执行步骤

- [x] 保留`docs/img/animations/boar/attack-sheet-raw.png`；新增`tools/prepare-boar-attack.py`，统一缩放、透明检查、边界验证、报告与预览。先输出到artifacts，检查后显式发布。
- [x] 新增`src/presentation/attack-frames.ts`抽取原鼠投影，`MouseAttackFrames`保留兼容子类。`CombatFeedback`增加岩甲豚读取；用真实Session测试完整攻击、取消、多实例、暂停和只读性，复跑鼠回归。
- [x] `character-art.ts`增加boarAttackArt、resolveBoarArt与公共characterAnimations；`ArtLayer.ts`与`Battlefield.tsx`改用公共清单。纹理不可用时保留原绘制路径。
- [x] 为清单、资源尺寸、脚底、图片池复用补验证；运行相关测试、全套测试、typecheck与生产构建，检查启动边界。
- [x] 更新素材README、项目README与验收记录；提供八灵试玩入口，注明浏览器人工验证范围。本轮不自动提交。

浏览器连接失败，实机目视验收待完成，具体边界见`docs/reviews/2026-11-06-boar-attack-integration.md`。

自审：上述步骤覆盖设计的素材来源、缩放落点、真实出手、回退与时钟语义；无需新增战斗规则或试玩系统。
