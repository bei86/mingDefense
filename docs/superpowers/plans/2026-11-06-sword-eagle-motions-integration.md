# 青锋隼三动作接入计划

目标：将用户上传的待机、受击、重伤素材正确命名并接入四动作优先级，保持真实攻击规则。

设计：docs/superpowers/specs/2026-11-06-sword-eagle-motions-integration-design.md。

- [x] 查看三张原图与alpha/布局/哈希，按内容git mv命名，保留旧攻击下载副本，识别重伤跨格羽毛。
- [x] 新增tools/prepare-sword-eagle-motions.py与命名映射，审核实际间隙、每组共同缩放、活体胸腹落点/重伤整组下降，先查看接触表再显式发布并记录哈希。
- [x] 扩展swordEagleMotionArt四动作和Feedback仲裁，Battlefield读取动作；缺图降级、减少动态与真攻击投影沿用现有机制。
- [x] 添加有意义的素材与真实战斗表现测试，运行针对性/完整测试、类型检查/构建，尝试浏览器八灵试玩，记录边界。
- [x] 更新素材README、提示词状态、主README、角色进度和验收记录，按simplify复核新代码；本轮不提交或推送。

结果：25项针对检查、1435项默认全量测试通过（30项默认跳过），类型检查与构建通过。浏览器宿主不可用，实机仍待确认。详见docs/reviews/2026-11-06-sword-eagle-motions-integration.md。
