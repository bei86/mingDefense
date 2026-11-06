# 青锋隼动作素材

四组动作均已接入：攻击6帧、待机4帧、受击3帧、收翼降落休息5帧。详见[三动作接入记录](../../../reviews/2026-11-06-sword-eagle-motions-integration.md)，实际游戏目视仍待确认。[原攻击提示词](../../../art/2026-11-06-sword-eagle-attack-prompt-copy-ready.md)和[攻击接入记录](../../../reviews/2026-11-06-sword-eagle-attack-integration.md)保留来源。

[原三组提示词](../../../art/2026-11-06-sword-eagle-remaining-animation-prompts-copy-ready.md)与`motion-reference-canvas.png`保留供后续修图，无须重新生成。以下均为原始下载图的内容命名，哈希与[命名对照](source-names.json)一致：

| 原下载名 | 现文件名 | 说明 |
| --- | --- | --- |
| image-1793959955416-1.png | attack-sheet-download-original.png | 与之前已整理的attack-sheet-raw.png字节相同，保留下载副本 |
| image-1793961384000-1.png | idle-sheet-raw.png | 四帧待机，1254×1254 |
| image-1793961389832-1.png | hurt-sheet-raw.png | 三帧受击，2138×736 |
| image-1793961440947-1.png | fallen-sheet-raw.png | 五帧收翼降落休息，1774×887 |

| 文件 | 用途 |
| --- | --- |
| reference.png | 最初静态WebP解码后逐像素一致的384×317 RGBA历史参考 |
| reference-canvas.png | 最初静态参考的512×512透明画布，历史来源保留 |
| reference-info.json | 原图、参考图与画布的SHA256及尺寸记录，generatedAnimation为false |
| attack-sheet-raw.png | 外部生成的1536×1024 RGBA六帧原始下载文件，完整保留 |
| prepared/attack.webp | 与public发布文件一致的无损六帧条，2688×352 |
| prepared/preparation.json | 非均匀切线、共享比例、胸腹对齐与发布哈希 |
| motion-reference.png | 当前攻击首帧448×352 RGBA无损导出，后续动作统一参考 |
| motion-reference-canvas.png | 512×512透明画布，首帧不缩放地放在(32,80)，三次都上传此图 |
| motion-reference-info.json | 当前攻击来源/哈希、透明边距与胸腹坐标记录，未生成新动画 |
| idle-sheet-raw.png | 待机4帧，2×2，原始下载内容未变 |
| hurt-sheet-raw.png | 受击3帧，3×1，原始下载内容未变 |
| fallen-sheet-raw.png | 收翼降落休息5帧，5×1，原始下载内容未变 |
| prepared/idle.webp、hurt.webp、fallen.webp | 与public发布条一致的无损动作归档 |
| prepared/motions-preparation.json | 三动作切线、共享缩放、落点与发布哈希 |
| source-names.json | 原下载名、新文件名与SHA256对照 |

发布来源为`public/assets/art/sword_eagle_idle.webp`，原始素材`docs/img/sword_eagle_idle.png`保持不变。重建命令（在项目根目录执行）：

```powershell
uv run --with pillow python -B tools/prepare-sword-eagle-reference.py
```

脚本锁定已审核发布图的哈希、模式与尺寸，验证输出像素、外围透明和源文件未变。它只导出参考，不生成攻击动画、不覆盖已有角色原图。

青锋隼面向右前方，悬空双翼以胸腹/躯干中心为共同空间基准，不套用鼠/豚的地面脚底锚点。收到新图后再审核比例、翼尖边界与连续动作；飞剑和剑阵仍由游戏独立绘制。

原图第4帧右翼跨过512切线，处理时将底行分隔移到x567，完整保留至x565的翼尖。整组0.625缩放，448×352固定画布，胸腹锚点(240,224)，绘制原点(240,180)。348×258固定运动包络决定棋盘中的统一缩放，双翼最宽时也留在2×2绘图区内，不因收翼放大或振翼缩小。原图alpha<=8的背景残影清理，主体颜色与原图不变。

先离线生成接触表、GIF和报告，查看后显式发布：

```powershell
uv run --with pillow python -B tools/prepare-sword-eagle-attack.py
# 查看 artifacts/sword-eagle-attack/contact-sheet.png 与 attack-slow.gif 后：
uv run --with pillow python -B tools/prepare-sword-eagle-attack.py --publish
```

处理工具锁定本次原图哈希，替换原图后必须重新审核，不能直接套用本次人工切线与胸腹坐标。当前已按用户“下一步”导出新的后续动作参考，攻击的完整实机目视仍待确认。重建新参考：

```powershell
uv run --with pillow python -B tools/prepare-sword-eagle-motion-reference.py
```

新参考与当前攻击首帧逐像素一致，旧`reference`系列继续保留，不覆盖。待机与受击保持悬空胸腹中心，重伤允许身体降低并保持最终虚拟接触高度；不把鸟类降落套成鼠/豚脚底全程固定的站姿处理。

三组动作处理命令：

```powershell
uv run --with pillow python -B tools/prepare-sword-eagle-motions.py
# 查看 artifacts/sword-eagle-motions/contact-sheet.png 与各动作 preview.gif 后：
uv run --with pillow python -B tools/prepare-sword-eagle-motions.py --publish
```

重伤原图前两帧羽毛跨过名义355/710分界，切线改为432/775，其他分界1064/1419。每组只用一个比例，待机按最宽翼部再统一限幅，受击和重伤从首帧高度匹配攻击。共用448×352画布、348×258参考体积、(240,180)原点；活体胸腹保持(240,224)，重伤采用全组固定竖向偏移保留逐步下降，末两帧接触高度稳定。待机200ms/帧，受击60ms/帧，重伤80ms/帧到末帧保持；动画不改变模拟规则。
