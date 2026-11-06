# 青锋隼攻击接入计划

目标：保留用户原图，完整恢复跨格翼尖，按真实攻击事件播放六帧。

设计：docs/superpowers/specs/2026-11-06-sword-eagle-attack-integration-design.md。

- [x] 将附件精确复制为docs/img/animations/sword_eagle/attack-sheet-raw.png；新增tools/prepare-sword-eagle-attack.py，锁定哈希并采用非均匀切线、共享缩放、人工胸腹锚点，生成接触表/预览/报告，查看后显式发布到prepared与public。
- [x] 新增鹰描述与缺图降级，扩展AttackFrames种类，CombatFeedback增加独立鹰跟踪，Battlefield按帧绘制。新动作不改模拟。
- [x] 测试真实鹰攻击/剑阵、取消与事件隔离、暂停/倍速/减少动态/换战斗/纯读取；素材测试验证哈希、发布一致与跨格边界。执行相关检查、完整默认测试、构建。
- [x] 尝试浏览器八灵试玩，记录实际结果和边界；更新README、素材状态、动作进度与验收记录。按simplify复核本轮代码；本轮不额外提交。

结果：20项针对测试、1429项完整测试通过（30项默认跳过），类型检查/构建通过。浏览器宿主不可用，实机画面待用户确认；离线接触表已查看。详见docs/reviews/2026-11-06-sword-eagle-attack-integration.md。
