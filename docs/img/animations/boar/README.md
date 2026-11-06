# 岩甲豚动作素材

- `reference.png`：当前发布boar_idle.webp解码后无损导出的384×273 RGBA参考。
- `reference-canvas.png`：768×512透明画布，参考像素不缩放，位置为(192,119)。优先上传这张生图。
- `reference-info.json`：发布图哈希、尺寸和偏移，generatedAnimation=false。
- `attack-sheet-raw.png`：用户提供的1536×1024透明六帧原图，从`image-1793932384892.png`改名，文件字节不变。
- `prepared/attack.webp`：六个384×288固定画布横排，统一缩放0.625、横向偏移32px，仅校正脚底纵向漂移；已接入真实攻击。
- `prepared/preparation.json`：原图/发布图SHA256、每帧边界、偏移、脚底和绘制原点。

可复制提示词：[岩甲豚攻击动作](../../../art/2026-11-05-boar-attack-prompt-copy-ready.md)。不覆盖docs/img/boar_idle.png或public/assets/art/boar_idle.webp；新纹理独立放在public/assets/animations/boar。

重建参考（不调用生图API）：

```powershell
uv run --with pillow python tools/prepare-boar-reference.py
```

收到新图后先查看实际分格。规则3×2且边缘完整时，可用`tools/prepare-animation-strip.py`整理到artifacts内的新目录；不规则帧图应先制定人工切分边界。工具统一缩放/偏移，不自动对齐脚底、不逐帧裁紧，也不发布到游戏。

本张原图有脚底纵向漂移，使用专用离线处理器；先检查预览再显式发布，不调用生图API：

```powershell
uv run --with pillow python -B tools/prepare-boar-attack.py
# 检查artifacts/boar-attack/contact-sheet.png、attack-slow.gif、index.html
uv run --with pillow python -B tools/prepare-boar-attack.py --publish
```

此处理器锁定已审核原图SHA256；换图需重新审查分格/锚点，不能直接复用。按alpha≥96识别脚底，六帧均对齐画布y=256，统一体积308×218、原点(193,147)。没有把旧静态图强塞进第一帧，因此不会在每次攻击时切换造型。当前只完成攻击，待机用首帧、受击/倒下沿用原色调和淡出。
