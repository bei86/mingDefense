# 阵型预设阵容差异实施计划

**Goal:** 预设失效时清楚列出缺少和多出的灵兽阶数、数量。

**Architecture:** formation-presets纯函数统计种类/阶数净差，planFormation在阵容不匹配错误上携带结果；原预设面板只负责渲染两组列表。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-difference-design.md`

## 执行与全局约束

按用户连续开发授权在本会话顺序实施；不启用子代理，不另设确认。保持整笔应用/撤销、3槽存储与开发隔离、数值与规则、存档格式、依赖和启动命令。本轮新功能不提交、不推送。

## Review Focus

1. 总数相同也可能种类、阶数不同，不能提前用长度决定差异。
2. 备战席与重复同阶都必须计数，升阶不可折算。
3. 无效数据先拒绝；锁格或相同站位不能误称缺兽。
4. 比较不得排序或修改原数组、消耗随机数、影响撤销。
5. 多差异时320宽仍可滚动，操作按钮可用键盘到达。

## 任务1：纯差异统计与游戏校验

Files: `src/game/formation-presets.ts`、`src/game/formation-presets.test.ts`。

- [x] 先写测试断言阵容错误带difference，运行确认失败。核心断言：

```ts
expect(planFormation(s.preparation, preset)).toMatchObject({
  difference: {
    missing: [{ kind: 'boar', rank: 2, count: 1 }],
    extra: [{ kind: 'boar', rank: 3, count: 1 }],
  },
});
```

- [x] 定义`FormationRosterDifference`，missing/extra均为`{kind: HeroId; rank: number; count: number}[]`。有效预设先累计预设减当前的带符号计数，再按heroIds/1..6输出；仅非空时返回带difference的原通用错误。
- [x] 覆盖同总数换种/升阶、重复同阶、单侧差异、备战席、ID/位置/顺序不影响、非法预设、锁格、全Session只读；保持现有原子应用测试。

## 任务2：预设面板与验证交付

Files: `src/ui/FormationPresets.tsx`、`src/ui/formation-presets.css`、`README.md`、`docs/reviews/2026-10-23-formation-difference.md`。

- [x] 从`plan && 'error' in plan ? plan.difference : undefined`派生清单。两个有标题的列表显示名称、阶数、只数，空侧为无；说明当前多出是相对预设，更新站位需保存并确认覆盖。
- [x] CSS限于预设面板，使用可换行单列清单，不增加常驻HUD。React最佳实践与simplify自查，不引入effect/memo/新状态。
- [x] 定向测试、全测试、build、显式startup-build、Prettier与空白检查。
- [x] game-playtest正常UI保存→招募→差异→切槽→覆盖；320/390截图、滚动和键盘操作；生产恢复与返回整备，无状态注入。
- [x] 记录真实证据与限制，更新README、勾选计划；关闭自己标签、恢复视口、停止自己的服务。
