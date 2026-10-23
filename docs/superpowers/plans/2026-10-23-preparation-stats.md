# 整备当前站位属性实施计划

**Goal:** 在整备时按需查看选中上阵灵兽的天赋和当前光环后的属性。

**Architecture:** 独立只读模型克隆当前开战阵容并读取现有属性函数；局部details组件按需生成表格，选择变化重新收起。PreparationPanel只负责传递准备数据和单位ID。

**Tech Stack:** React19、TypeScript、Vitest、CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-preparation-stats-design.md`

## 执行约束

沿用当前会话自主顺序执行，不派子代理、不重复确认。本轮不提交不推送，不修改战斗逻辑、数值、RNG、v24/schema2、默认命令、资产及依赖。模型只读取，不执行start/tick/transfer或存储。

## Review Focus

光环以整体中心计算且多狐不叠加；备战狐不得生效。桃固定产钱不能被攻速误导。狐显示施盾比例而非攻击。间隔向上取整且聚灵受上限影响。界面不能把基础命中值说成最终伤害或DPS。

## 任务1：只读属性模型及真实战斗对照

**Files:** 新`src/ui/preparation-stats.ts`、`src/ui/preparation-stats.test.ts`。

**Interface:** `preparationStats(preparation: Preparation, unitId: number)`返回`{kind,rank,position,rows:{label,base,current}[],auraSources:{id,rank,position}[]}`或null。未知ID、备战返回null。

- [x] 写测试，确认缺模块失败。使用真实Session.start后的最大生命、attackDamage及stepCombat冷却验证投影；例如：

```ts
const rows = preparationStats(s.preparation, 5)!.rows;
expect(s.start()).toBeNull();
expect(rows.find((row) => row.label === '最大生命')!.current)
  .toBe(String(s.battle!.allies[0].maxHp));
```

- [x] 实现只读模型，复用createCombat/attackDamage/heroRange，按现行步长计算常态/聚灵间隔。以center/distance列狐来源，排除备战和低阶，多个来源仅说明一次加成。桃和狐分支明确。
- [x] 测试八灵、光环边界、多格中心、未领取/备战排除、天赋专属、狐盾/桃间隔、读取不影响state/RNG/revision/撤销，真实移动与撤销后重算。运行新测试/typecheck。

## 任务2：整备折叠表

**Files:** 新`src/ui/PreparationStats.tsx`、`src/ui/preparation-stats.css`；改`src/ui/PreparationPanel.tsx`。

- [x] details默认收起，展开才调用模型；语义table列项目/基础/当前。列出光环来源、坐标和不叠加说明；标清伤害/施盾/间隔含义。
- [x] PreparationPanel仅在chosen.position存在时接入，key为chosen.id。保留旧摘要/技能和所有原操作，战斗卸载组件。CSS使用紧凑表格、自然换行和可见键盘焦点。
- [x] 按React最佳实践及simplify复查，Prettier/typecheck、新测试、完整test及build；构建后显式startup-build检查。

## 任务3：浏览器与文档交付

- [x] game-playtest使用独立开发端口：合法首战部署后展开/折叠，移动/撤销和选择切换；八灵隔离场景查看狐/桃与光环。截图并记录控制台，不注入游戏内部状态。
- [x] 生产独立端口正常恢复，核对真实视口后再作窄屏结论；不能设置或运行时明确记录，关闭自己的标签及服务，恢复临时视口。
- [x] README与`docs/reviews/2026-10-23-preparation-stats.md`记录实现和证据，Git空白检查，本轮不提交不推送。
