# 青锋隼攻击素材准备记录

## 交付

上一批岩甲豚四动作已本地提交为`4b37fc8 补齐岩甲豚待机受击与伏地动画`。本轮继续单角色推进，交付青锋隼[六帧攻击完整提示词](../art/2026-11-06-sword-eagle-attack-prompt-copy-ready.md)、[上传参考画布](../img/animations/sword_eagle/reference-canvas.png)、[素材说明与重建命令](../img/animations/sword_eagle/README.md)。本轮新内容留待下次提交，未推送远程。

## 来源与检查

- 来源：`public/assets/art/sword_eagle_idle.webp`，384×317 RGBA，SHA256为`35da08851433af27a26e3159f7776cc2d5326bfa925fcf055a39dac07a1979a0`。
- `reference.png`与发布图解码RGBA逐字节一致；512×512画布将其不缩放地放在(64,97)，粘贴区域逐字节一致，外围alpha为0。
- `uv run --with pillow python -B tools/prepare-sword-eagle-reference.py`执行成功，输出回读验证通过，发布WebP和原始PNG哈希未变。完整哈希及尺寸见[来源报告](../img/animations/sword_eagle/reference-info.json)。
- 已查看参考画布：青玉剑形冠羽、青色双翼与尾羽、白胸腹、金眼、黄脚深爪完整；保持右前方三分之四朝向，四周透明边距充足。查看器的黑色底不属于图像内容。
- 提示词为独立完整段落，指定3列×2行、6帧、右前方朝向、胸腹悬空中心、翼部关节变化与透明边距；不套用脚底贴地锚点，不把剑阵/飞剑绘进角色帧。
- 文本检查通过：4个复制块、6个顺序姿态、参考路径存在、预期原图目录存在，当前新原图确实尚未提供。新增本地文档和图片链接已检查。
- `npx.cmd vitest run tools/art-assets.test.ts src/render/character-art.test.ts`：2个文件、5项测试通过。
- `git diff --check`通过；只有仓库现有LF/CRLF转换提示，没有空白错误。
- 按simplify复核新增离线导出脚本：来源校验、无损导出、回读验证和报告各自清楚，没有必要再增加抽象或改动运行时。

## 当前边界

尚无`attack-sheet-raw.png`，不声称新攻击动画已经完成。未改`src/`、`public/`、依赖、战斗规则、存档或随机流；角色动作清单仍为8组，战场总素材仍为47张。当前离线准备不需要重新运行完整战斗测试或浏览器验收，也不扩展上一批已有目视验证结论。

收到原始下载的整张六帧图后，先审核alpha、格子边界、翼部与造型连续性，再制定整组共同缩放和悬空落点，接入现有真实攻击事件；之后再以认可的首帧准备其他动作。

后续状态：用户已提供六帧图并完成处理与接入，上文保留为收到图之前的准备记录；当前实现与验收边界见[攻击接入记录](2026-11-06-sword-eagle-attack-integration.md)。
