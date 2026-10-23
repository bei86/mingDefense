# 阵型应用前后首目标对照实施计划

**Goal:** 应用预设前按实际入口比较当前与预设的静态首个寻敌目标。

**Architecture:** formation-targeting纯投影Preparation和成功FormationPlan，复用targetingPreview；FormationTargeting提供默认收起的三列入口对照，原面板以独立key挂载。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-targeting-design.md`

## 执行与全局约束

用户持续授权下顺序实施，不派子代理、不另设确认。保留数值/规则、3格接敌、原子应用/撤销、存储与开发隔离、存档格式、依赖、素材和启动命令。本轮新功能不提交、不推送。

## Review Focus

1. 当前和预设必须使用同一个入口参考点，按plan实例映射。
2. 前排优先于低阶，低阶优先于高仇恨；多格起点归排。
3. 同种同阶距离随入口变化，ID不能因数组顺序变化而串位。
4. 备战和待领招募不计，当前空场仍能与有上阵的预设比较。
5. 展开/切槽/应用/撤销不得改变当前数据或留下旧对照，320宽操作可达。

## 任务1：对照投影及实战寻敌验证

Files: 新`src/ui/formation-targeting.ts`、`src/ui/formation-targeting.test.ts`。

- [x] 写失败测试。真实预设把前排桃与后排鼠换位，生成plan后比较当前/目标；用createCombat与spawnEnemy在各参考点执行首次stepCombat，核对targetID。

```ts
const view = formationTargeting(s.preparation, planFormation(s.preparation, preset))!;
expect(view.map((row) => row.column)).toEqual(config.waves.spawnColumns);
expect(view[0].before!.id).toBe(11);
expect(view[0].after!.id).toBe(10);
```

- [x] 实现`formationTargeting(p: Preparation, plan: FormationPlan | null): FormationTargetingEntry[] | null`，entry含column与before/after（TargetingEntry|null）。成功方案下按配置入口调用既有纯预览，失败/无方案返回null。
- [x] 测试前排/阶数/仇恨、多格、同类入口距离/ID顺序、备战/空场、无效/相同/锁格错误、完整状态只读、输出位置不共享、应用后及undo一致。

## 任务2：对照UI与验证交付

Files: 新`src/ui/FormationTargeting.tsx`、`src/ui/formation-targeting.css`；改`src/ui/FormationPresets.tsx`、README；新review。

- [x] Props为preparation和plan。用expanded UI状态跟随details onToggle，仅展开时投影。无成功plan返回null，标题“对照首个受击目标”；三个入口卡片内竖排当前/应用后，显示名称阶数编号/仇恨坐标或无上阵灵兽。
- [x] 展示静态入口参考与实战差异文案，summary44px，CSS限定组件，父弹窗滚动。以targeting-${slot}作为key重置，避免与小图/站位预览重复。
- [x] React最佳实践、simplify复查，定向/全测试、build、显式startup-build、格式/空白检查。
- [x] game-playtest隔离八灵场景正常保存与移动桃，核对狐→桃目标；390/320展开/键盘/滚动/切槽，应用后核对原受击顺序入口、撤销重现。生产只检查原进度和空槽恢复，无状态注入。
- [x] README/review记录实际边界，勾选计划；关自己标签、复原视口、停自己的服务，保留新功能未提交。
