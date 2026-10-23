# 天赋选择收益预览实施计划

**Goal:** 三选一卡片显示当前→选择后累计贡献、存活施放者和生息补量。

**Architecture:** talent-preview纯投影复用配置/bonus/maxHeroHp，TalentPreview组件只显示；TalentModal沿原选择回调，不复制战斗或模拟未来。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-talent-preview-design.md`

## 执行与约束

连续开发授权，本会话顺序实施、无子代理，不另设确认；新功能不提交不推送。保持v24/schema2、核心规则、数值、抽取/RNG、存档、素材、依赖和默认启动命令。

## Review Focus

1. 实际补量必须对照选择逻辑，不把倒下当可复活。用选择前后真实生命差与最大生命逐只验证。
2. 专属按最低阶与存活统计；备战/未领取不算，已有剑阵不能因施放者倒下被宣称无收益。覆盖同种多阶与全倒下。
3. 本天赋累计与最终收益分开；攻速减速上限、残血与非首领条件、百分点不误作百分比。逐一断言13类格式与条件。
4. 模型不得消费RNG、刷新候选、推进时钟或改变Session。真实合法三选一前后JSON完整对照，再选择验证仍可继续。
5. 文字增长不导致卡片横向溢出或阻止第三项键盘选择。390/320实际DOM、截图与Tab/Enter检查。

## 任务1：纯收益投影

**Files:** 新`src/ui/talent-preview.ts`、`src/ui/talent-preview.test.ts`。

- [x] 先编写真实Session三选一无副作用与生息补量测试，确认模块缺失失败。

```ts
const before = JSON.stringify(session);
const preview = talentPreview(session.battle, session.battle!.choices[0]);
expect(preview).not.toBeNull();
expect(JSON.stringify(session)).toBe(before);
```

- [x] 实现`TalentPreviewModel`及`talentPreview(battle: Combat | null, id: BuffId): TalentPreviewModel | null`，守卫候选/上限，计算bonus前后值、配置范围及条件；生息只复制Progression和buffs并调用maxHeroHp。
- [x] 覆盖13类、格式、满层/非候选、范围、备战/阶数/倒下、生息真实选择与零存活；运行定向测试及typecheck。

## 任务2：三选一接入

**Files:** 新`src/ui/TalentPreview.tsx`、`src/ui/talent-preview.css`；改`src/ui/CampaignPanels.tsx`。

- [x] 新组件用span呈现累计、范围、条件；层数由父卡片显示当前→后/上限，保留原单层描述及点击回调。模型null时保留原层数显示，不禁用原选择。
- [x] React最佳实践/simplify复查，限定新增样式，卡片文本min-width0且可换行，不嵌套交互控件。
- [x] Prettier、全test、build、显式startup-build检查；已有选择/存储/战报回归通过。

## 任务3：验收交付

- [x] game-playtest开发首战与既有中后期检查点合法三选一，核对叠层/专属及选择后继续；390/320滚动、焦点和截图、控制台。
- [x] 最终生产包正常恢复与三选一、收藏入口回归；只记录实际已观察结果。
- [x] README和review记录证据、边界，标记计划；清理自己的服务/标签/视口，Git空白检查，新代码留工作区。
