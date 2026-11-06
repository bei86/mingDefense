# 岩甲豚攻击样板准备记录

用户实测反馈烬灵鼠实战“可以”，并要求提交后继续。已提交bbc5aac「新增烬灵鼠实战动作对照场景」，未推送。本轮推进第二个角色的攻击素材准备，不扩大烬灵鼠实测范围，也不把静态图变换标成新动作。

## 本次交付

- docs/img/animations/boar/reference.png为发布boar_idle.webp无损解码的384×273 RGBA PNG；reference-canvas.png为768×512透明画布，原像素未缩放，放在(192,119)。reference-info.json保留来源哈希与尺寸。
- docs/art/2026-11-05-boar-attack-prompt-copy-ready.md给出完整可复制提示词、优先上传图、备选紧凑参考、六帧顺序、保存位置与回传后的处理步骤。只生成一张3×2六帧攻击，不提前生成其他动作。
- 工具prepare-boar-reference.py可重建同一参考；prepare-animation-strip.py只检查规则网格，全部帧同一scale/offset，不逐帧裁紧或推断脚底，输出逐帧PNG、无损WebP条、接触表与报告。
- CLI只允许仓库artifacts下的新输出目录；拒绝已有输出、非透明/无alpha、空帧、网格不整除、alpha>8主体碰到分格边缘或输出边缘。全部验证在写入前完成，磁盘异常不保证原子提交。工具不会写入public或更新运行时清单；报告始终要求人工审核并标记未发布。
- 工具说明docs/art/animation-strip-tool.md提供可执行命令及限制。3×2等格预览参数不是最终游戏落点，实际素材必须到图后审核标定。

## 验证

离线工具测试先因模块缺失失败，实现后11项unittest通过。所有输入均为明确标注的合成矩形标记图，不是岩甲豚新素材。验证统一缩放、保留帧间相对位移、输出WebP与逐帧PNG一致、原图字节未变、无透明/无alpha、空帧、跨格、非法尺寸/scale、输出裁切、最后一帧失败无部分文件、禁止覆盖已有目录，以及真实CLI成功输出和第二次运行拒绝覆盖。

原有发布素材完整性、角色纹理降级、图片池复用共3文件3项Vitest通过。游戏src、发布素材与npm依赖没有改动，因此没有重新跑全量战斗测试或生产构建。git diff --check通过。Python缓存加入.gitignore，临时测试输出使用忽略的artifacts并自动清理。

参考导出过程比较PNG与发布WebP解码像素一致，验证原PNG和发布WebP哈希未变。发布WebP的SHA256为baebe0d23333984fe29c41cb4a9a5c3c63e3c0bb6adc6ad4c458c4f0d34dd1a5。查看参考画布，主体、岩甲、獠牙和尾巴完整，真实alpha存在；并核对参考画布边缘alpha为0。参考只包含一只静态岩甲豚，没有新增六帧图。

按brainstorming与writing-plans记录范围、备选与实施步骤；按sprite-pipeline保留唯一参考和整组生成；按simplify复核统一变换、验证先于写入、路径限制与无发布副作用。图查询/索引工具不可用且根目录无.codegraph，使用已知路径读取。未调用生图API，未操作浏览器或正式存档。

## 仍需新图

当前缺少docs/img/animations/boar/attack-sheet-raw.png。需按可复制文档上传参考并生成这一张，收到后检查同一造型、六帧连续性、四足/岩甲一致、实际透明与脚底，再切片、预览及接真实攻击事件。此次交付的是素材准备和工具，不是岩甲豚逐帧攻击已完成。新开发未提交。
