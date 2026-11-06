# 青锋隼剩余动作准备记录

用户要求继续下一步，本轮提供[三组完整可复制提示词](../art/2026-11-06-sword-eagle-remaining-animation-prompts-copy-ready.md)和[统一上传参考](../img/animations/sword_eagle/motion-reference-canvas.png)。待机4帧2×2、受击3帧3×1、重伤5帧5×1，各生成一张整图，不重复生成攻击。现有攻击已接入，完整实机目视仍待确认，没有将用户继续操作解释为已测试通过。

## 参考来源

发布来源为`public/assets/animations/sword_eagle/attack.webp`，2688×352 RGBA，SHA256为`01c36818072c9df2e84096c0d7036b7e0403cc9246408f35c846f352bfbd631f`。导出第1帧(0,0,448,352)，PNG像素与发布条对应区域逐字节一致，不缩放、不重新生成。

- `motion-reference.png`：448×352，SHA256为`3dfd157fc7ca61e37ee623982dc9d9e16807cd56dcbaaf14fcc906b1b36d51c4`。
- `motion-reference-canvas.png`：512×512，在(32,80)粘贴同一首帧，SHA256为`1f52b27e307205759db58109d2081cba250cc1ecccaa27f0e252a0403ac3ce94`。胸腹参考点(272,304)，绘制原点(272,260)。
- `motion-reference-info.json`：记录来源和偏移，`derivedFromExistingAnimation=true`、`newAnimationGenerated=false`。

已运行`uv run --with pillow python -B tools/prepare-sword-eagle-motion-reference.py`。工具锁定已审核发布哈希及尺寸、核对原始攻击和归档报告，验证两张输出PNG像素、画布外围alpha为0，以及发布条/原始攻击/旧参考/静态原图等全部输入哈希未变。

已查看参考画布：右前方朝向，脸部、剑形冠羽、双翼、尾羽和爪完整，四周留白充分。查看器黑色底是透明显示方式，PNG外围实际alpha为0。

## 提示词与检查

三个动作的提示词均独立包含同一角色造型、右前方朝向、精确帧数与布局、逐帧动作、整组比例、完整边距、真实透明和保存名。待机和受击保持胸腹悬空位置；重伤收翼降落允许身体逐步降低，后两帧保持虚拟接触高度，不按包围框重新抬高/放大，不套用四足伏卧。不绘制场景、剑阵、飞剑或淡出效果，保留游戏独立表现。

- 文本检查通过：6个text复制块（2个上传路径、1个保存目录、3段动作），每段分别有4/3/5个顺序姿态，布局与尺寸匹配。
- 参考路径、保存目录及文档链接有效；当前idle/hurt/fallen三张原图仍不存在，状态准确标记为待生成。
- `npx.cmd vitest run tools/art-assets.test.ts src/render/character-art.test.ts`：2个文件、7项测试通过。
- `git diff --check`通过；仅有既有LF/CRLF转换提示。
- 按simplify复核新增导出工具，沿用既有离线参考流程，来源校验、像素验证与报告均直接明确，无需增加运行时抽象或重复测试脚手架。

## 当前边界

本轮仅新增离线导出工具、参考图和文档，没有生成或接入三组新动作，没有改动src/public运行时代码、依赖、战斗规则、随机流或存档。工作区保留上一轮攻击接入的未提交内容，本轮也未提交或推送。运行时仍9组动作、战场素材48张；不重复运行完整模拟/构建或扩大上一轮浏览器验收结论。

用户生成原图后，再审核真实alpha、羽毛连续性和所有格子边界；对活体动作使用稳定胸腹基准，对重伤保留逐步下降，再按实际图确定统一比例与接入参数。

后续状态：用户已提供三张原图，命名并接入四动作；本文保留收到图前的准备记录，当前实现与验证边界见[三动作接入记录](2026-11-06-sword-eagle-motions-integration.md)。
