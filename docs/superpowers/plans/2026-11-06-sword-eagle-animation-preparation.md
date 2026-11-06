# 青锋隼攻击动作准备计划

**Goal:** 提供可直接用于外部生成的青锋隼六帧攻击参考及完整提示词。

**Architecture:** 从当前发布图精确导出RGBA参考和单角色透明边距画布；独立素材目录和来源报告，不注册新运行时动画。

**Tech Stack:** Python/Pillow、Markdown。

**Spec:** `docs/superpowers/specs/2026-11-06-sword-eagle-animation-preparation-design.md`

## 约束与检查重点

- 唯一参考来自当前sword_eagle_idle.webp，造型/朝向以实图为准。
- PNG导出逐像素一致，不缩放、不生图；外围透明。
- 六帧3×2，双翼不越格，胸腹悬空中心不因包围框居中而跳动。
- 角色帧与剑阵/飞行物分离，收到图再审核真实释放衔接。
- 未收到新图前不增加public纹理，不改变模拟/依赖/存档。

## 步骤

- [x] 新增tools/prepare-sword-eagle-reference.py：核对384×317 RGBA与源SHA256，保存reference.png和512×512参考画布(64,97)，写报告；验证回读像素、透明外围和源文件未变。
- [x] 运行导出并查看透明参考，确认冠羽/翼尖/尾羽/爪完整。
- [x] 新增docs/art/2026-11-06-sword-eagle-attack-prompt-copy-ready.md，包含上传图、六帧完整单段提示词、原图路径与接入边界；检查文本和链接。
- [x] 更新素材README、项目README、角色动作进度；运行素材检查和diff检查，记录本轮仅做素材准备。新工作留待下次提交。

结果：2个测试文件的5项素材检查通过，导出/提示词路径和链接已核对，diff检查通过。详见docs/reviews/2026-11-06-sword-eagle-animation-preparation.md。

自审：交付与悬空双翼角色的特殊锚点要求一致，不套用鼠/豚脚底处理，不伪造动画完成状态。
