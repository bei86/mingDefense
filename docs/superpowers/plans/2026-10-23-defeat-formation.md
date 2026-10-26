# 败后布阵回顾实施计划

**Goal:** 让玩家回到整备后仍能核对上次首批重伤的时间、原站位与当前变化。
**Architecture:** 独立纯函数捕获首批副本并生成逐兽对照，接入现有DefeatRecap与DefeatAdvice，无新增全局状态或副作用。
**Tech Stack:** TypeScript、React19、Vitest、现有CSS主题。
**Spec:** `docs/superpowers/specs/2026-10-23-defeat-formation-design.md`

## 约束与执行

按用户“提交并下一步开发”的持续授权，当前会话顺序执行。之前功能已提交；本轮新功能不提交不推送。不改规则、存档、随机、依赖、素材和原npm命令。

## Review Focus

- 同种同阶灵兽身份不能混用，合成被消耗的实例不能绑定到剩余者。
- 同批多只不制造先后，旧数据不能从伤害推测首批。
- 升阶保留编号仍可对照，退回备战不当作消失。
- 所有原位置为副本，移动和撤销不能改写旧事实，多格列出完整占格。
- 长列表在320宽可换行，收起不挡棋盘，无新默认展开长面板。

## Task 1：首批副本和当前对照

Files: 新建`src/ui/defeat-formation.ts`及测试，修改`defeat-advice.ts`。

- [x] 测试真实双鼠第一批为22.65秒编号6，另一只累计承伤相同不能误认；真实返回、移动/撤销、备战、两种合成的身份保留与消耗。
- [x] 实现`firstFallSnapshot(battle)`，只读取已有批次并复制身份和位置；缺数据undefined，空数组null。
- [x] 实现`defeatFormation(preparation, recap)`，跨关null；按编号与种类匹配，输出原身份/位置副本、当前阶数/位置副本、same/moved/reserve/absent状态。
- [x] 测试同批、多格、旧/空数据、输入与返回对象修改无污染；定向测试通过。

## Task 2：复盘UI

Files: 新建`src/ui/DefeatFormation.tsx`及CSS，修改`DefeatAdvice.tsx`。

- [x] 历史摘要显示首批秒数/只数或缺记录/无重伤；沿用原复盘折叠。
- [x] preparing才出现默认收起的原生details“对照首批重伤灵兽”，含名字、编号、上次阶数和完整占格、当前阶数及变化。
- [x] 复用主题色，嵌套summary样式限定范围，长文本换行；只读无操作按钮，不添加动画和状态订阅。
- [x] 按React与simplify技能自查，当前对照直接推导不缓存可变Session对象。

## Task 3：验证与记录

- [x] 全量测试、生产构建、构建后启动依赖检查、Prettier、Git空白检查。
- [x] 隔离局真实失败→布阵，对照移动/撤销/合成，键盘开合、320/390视口及截图、控制台；生产只读启动。
- [x] README和review记录实际结果与限制，清理自建浏览器页和服务，保留新功能未提交。

