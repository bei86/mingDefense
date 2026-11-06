# 岩甲豚三组动作接入计划

**Goal:** 将新增待机、受击、伏地三张原图处理并接入岩甲豚真实状态。

**Architecture:** 离线逐动作统一比例、共用画布与地面；抽出鼠/豚共用纯动作仲裁；CombatFeedback按原Actor状态读取。

**Tech Stack:** Pillow、TypeScript、Phaser、Vitest、Vite。

**Spec:** `docs/superpowers/specs/2026-11-06-boar-motions-integration-design.md`

## 约束与检查重点

- 保留源图字节与哈希；规则分格实际边界不能截断。
- 不逐帧放大居中，伏地体高自然下降；固定原点不污染图片池其他角色。
- 受击期间真实攻击照常释放，不补播；重复受击按实例重置。
- 护盾受击、倒下初读、结算、暂停、倍速和减少动态复用既有语义。
- 缺任意动作降级仍可游玩，不以测试通过代替浏览器验收。

## 步骤

- [x] 三张原图按用途命名；编写tools/prepare-boar-motions.py，锁定已审图哈希/尺寸，先输出artifacts再显式发布，生成脚底/缩放/原点报告与接触表、循环预览。
- [x] 检查放大与实际尺寸，确认伏地降低及6→1/待机衔接边界；发布三张无损WebP到prepared及public。
- [x] 抽出character-motion.ts，保留selectMouseMotion兼容接口；Feedback增加boarMotion并共用Actor投影，Battlefield和character-art接三组纹理。
- [x] 验证真实伤害/护盾受击、优先级、暂停/后台/选天赋、2倍速、减少动态、死亡末帧/重置、缺图回退；复跑鼠测试与资源完整性。
- [x] 跑全套测试、typecheck、构建与启动边界；尝试浏览器并记录实际验证范围，更新提示词状态/README。未获本轮提交指令，不新增提交。

浏览器连接不可用，游戏内人工观感仍待确认；不以离线接触表替代实机验收，见docs/reviews/2026-11-06-boar-motions-integration.md。
