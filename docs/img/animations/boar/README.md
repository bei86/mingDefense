# 岩甲豚动作素材

- `reference.png`：当前发布boar_idle.webp解码后无损导出的384×273 RGBA参考。
- `reference-canvas.png`：768×512透明画布，参考像素不缩放，位置为(192,119)。优先上传这张生图。
- `reference-info.json`：发布图哈希、尺寸和偏移，generatedAnimation=false。
- `attack-sheet-raw.png`：用户提供的1536×1024透明六帧原图，从`image-1793932384892.png`改名，文件字节不变。
- `prepared/attack.webp`：六个384×288固定画布横排，统一缩放0.625、横向偏移32px，仅校正脚底纵向漂移；已接入真实攻击。
- `prepared/preparation.json`：原图/发布图SHA256、每帧边界、偏移、脚底和绘制原点。
- `idle-sheet-raw.png`：4帧2×2原图1254×1254，原名image-1793938253154.png，字节未变。
- `hurt-sheet-raw.png`：3帧3×1原图2138×736，原名image-1793938261873.png，字节未变。
- `fallen-sheet-raw.png`：5帧5×1原图1774×887，原名image-1793938267882.png，字节未变。
- `prepared/idle.webp`、`hurt.webp`、`fallen.webp`：统一画布和落点的无损动作条，已接入。
- `prepared/motions-preparation.json`：三组原图/发布图哈希、每组统一比例、逐帧边界与平移。

- `motion-reference.png`：当前攻击条第1帧384×288 RGBA逐像素导出，用于后续三组动作。
- `motion-reference-canvas.png`：512×512透明画布，在(64,112)放置同一姿态，不缩放；本轮优先上传这张。
- `motion-reference-info.json`：当前攻击来源、首帧区域、两个参考PNG哈希与画布偏移；newAnimationGenerated=false。

攻击已接入，不用重做；[待机、受击与重伤的三组可复制提示词](../../../art/2026-11-06-boar-remaining-animation-prompts-copy-ready.md)使用新`motion-`参考，以保持与攻击一致。旧[岩甲豚攻击提示词](../../../art/2026-11-05-boar-attack-prompt-copy-ready.md)与静态reference文件保留供历史参考。不覆盖docs/img/boar_idle.png或public/assets/art/boar_idle.webp；新纹理独立放在public/assets/animations/boar。

重建参考（不调用生图API）：

```powershell
uv run --with pillow python tools/prepare-boar-reference.py
```

重建后续动作的统一参考（读取当前攻击首帧，不覆盖上述旧静态参考）：

```powershell
uv run --with pillow python -B tools/prepare-boar-motion-reference.py
```

收到新图后先查看实际分格。规则3×2且边缘完整时，可用`tools/prepare-animation-strip.py`整理到artifacts内的新目录；不规则帧图应先制定人工切分边界。工具统一缩放/偏移，不自动对齐脚底、不逐帧裁紧，也不发布到游戏。

本张原图有脚底纵向漂移，使用专用离线处理器；先检查预览再显式发布，不调用生图API：

```powershell
uv run --with pillow python -B tools/prepare-boar-attack.py
# 检查artifacts/boar-attack/contact-sheet.png、attack-slow.gif、index.html
uv run --with pillow python -B tools/prepare-boar-attack.py --publish
```

此处理器锁定已审核原图SHA256；换图需重新审查分格/锚点，不能直接复用。按alpha≥96识别脚底，六帧均对齐画布y=256，统一体积308×218、原点(193,147)。没有把旧静态图强塞进第一帧，因此不会在每次攻击时切换造型。

三组新动作也已收到并接入。它们与攻击共用384×288画布和原点，每个动作以首帧站姿高度匹配218px，整组只用一个比例；横向偏移固定，脚底y=256，伏卧体高自然降低。离线重建：

```powershell
uv run --with pillow python -B tools/prepare-boar-motions.py
# 检查artifacts/boar-motions/contact-sheet.png、各动作preview.gif与index.html
uv run --with pillow python -B tools/prepare-boar-motions.py --publish
```

待机4帧每帧200ms；受击3帧每帧60ms；重伤5帧每帧80ms后保持末帧。此处的GIF/HTML会循环，游戏里的重伤不会循环站回。动作只影响表现，真实攻击按现有事件释放；人工游戏验收范围见[接入记录](../../../reviews/2026-11-06-boar-motions-integration.md)。
