# 新增静态素材接入计划

**Goal:** 把已整理的新角色、两套二阶段和七种特效接入现有游戏。

**Architecture:** 原图脚本生成类型清单；art.ts统一映射；Battlefield只读消费flash和独立FieldEffects短暂事件，通过ArtLayer图片池绘制。

**Tech Stack:** 现有Phaser、React、TypeScript、Pillow、Vitest，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-expanded-art-design.md`

## 约束

保持已暂存图片与图鉴工作。备份在artifacts/art-integration-backup；不修改原图、存档、数值、RNG及运行命令。不接入身份不一致的变体；所有图片有加载失败回退。只读事件跟踪应覆盖开战、返回整备、重试、撤销、初次加载和暂停，避免假合成/假产钱。

## 任务

- [x] 扩展原图处理排除表并生成WebP；核验全部原图不变，更新敌人/首领/二阶段及预加载映射。
- [x] 实现只读短暂事件与有方向攻击图片，限制尺寸/数量并覆盖状态切换；接入Battlefield与图片池旋转。
- [x] 完成资源与行为测试、构建和全量回归；使用simplify复核新增代码。
- [x] 390/320宽度试玩普通战斗、八灵与首领，截图并更新README、素材清单和验收记录。

结果：56张WebP，65张原图哈希一致；334项测试通过、20项工具测试跳过，构建通过。浏览器样本及未覆盖范围见 `docs/reviews/2026-10-22-expanded-art.md`。保持未提交。
