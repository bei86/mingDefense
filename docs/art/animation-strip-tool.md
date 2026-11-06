# 离线动画帧图整理工具

此工具只处理规则网格，输出到本仓库artifacts下的新目录。不会注册游戏纹理、修改public或判断动作美术是否通过。它保留原网格中的相对位置：全部帧使用同一缩放与偏移，不识别脚底、不逐帧裁紧居中。

需要uv；Pillow使用临时环境，不必修改npm依赖。

```powershell
uv run --with pillow python tools/prepare-animation-strip.py --help
```

图返回后，如果实际为1536×1024、3列×2行完整规则网格，可以先运行下面的离线检查命令。每格512×512缩至256×256，居中放入384×256画布；这只是等格缩放预览参数，不是最终游戏的参考体尺寸或脚底标定值。

```powershell
uv run --with pillow python tools/prepare-animation-strip.py `
  --sheet docs/img/animations/boar/attack-sheet-raw.png `
  --out artifacts/boar-attack-grid-check `
  --columns 3 --rows 2 `
  --frame-width 384 --frame-height 256 `
  --scale 0.5
```

输出目录必须不存在；第二次检查可用新的目录名，例如`artifacts/boar-attack-grid-check-2`，原结果不会被覆盖。输入文件当前尚未生成，因此以上命令应在收到并保存新图后运行；不要拿单张参考图凑成六帧图。

产物：

- `01.png`至`06.png`：相同画布尺寸、同一变换的帧。
- `strip.webp`：按阅读顺序排列的横条，无损RGBA WebP。
- `contact-sheet.png`：深色背景的逐帧接触表，只有此检查图包含帧号。
- `report.json`：原图/输出SHA256、网格、共同scale/offset、逐帧边界；始终标记`reviewRequired=true`、`published=false`。

如需整组统一平移，同时传入`--offset-x`和`--offset-y`，单位为缩放后输出像素；不传则将缩放后的整格居中。只传一个偏移会报错。不要为某一帧单独改变缩放；脚底漂移或不规则排版应先人工审核并制定对应处理方案。

会拒绝：无alpha通道、完全不透明、空格、尺寸无法整除网格、可见主体碰到分格边缘、输出裁切、无效scale/尺寸、已有输出目录，以及CLI输出路径不在artifacts之内。可见边界按alpha>8判断，阈值写入报告。所有帧检查通过后才开始写文件；磁盘写入异常仍可能留下不完整目录，应另选新目录重跑。

不能自动判断：是否是同一角色、腿或牙的数量、动作是否连续、是否画进地面阴影、朝向或脚底是否漂移、是否有贴在透明画布中的伪透明棋盘格。这些都需要看图。通过本工具不等于素材已接入游戏。

运行工具测试（仅合成标记图，非角色素材）：

```powershell
uv run --with pillow python -B -m unittest discover -s tools -p test_prepare_animation_strip.py
```
