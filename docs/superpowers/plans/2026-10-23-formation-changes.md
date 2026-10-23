# 阵型应用前站位预览实施计划

**Goal:** 应用前显示实际方案中换位、上阵、退备战的数量与逐只起止位置。

**Architecture:** formation-changes纯投影当前Unit与FormationPlan成功结果，FormationChanges负责统计与原生折叠清单；FormationPresets在校验信息后条件挂载。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-changes-design.md`

## 执行与全局约束

用户连续开发授权，本会话顺序完成，不另设确认、不派子代理。保持原匹配/原子应用/撤销、规则与存档格式、依赖、素材和默认启动命令。本轮新功能不提交、不推送。

## Review Focus

1. 同种同阶实例应沿实际plan按ID映射，不依赖数组索引。
2. null不是棋盘0,0；上阵和退备战各计一次，不当成两次换位。
3. 相同站位/校验失败不显示假预览，不消耗RNG或更改撤销。
4. 满36格循环换位展示完整，位置对象不能共享修改源状态。
5. 明细收起/切槽/320宽键盘导航不妨碍应用和返回。

## 任务1：差异投影和真实方案回归

Files: 新`src/ui/formation-changes.ts`、`src/ui/formation-changes.test.ts`。

- [x] 先写失败测试：使用真实Session捕获预设，交换棋盘和备战席并移动第三只，期待各1只、总3只；应用后逐只目标一致，undo回到预览前。

```ts
const plan = planFormation(s.preparation, preset);
const view = formationChanges(s.preparation.units, plan);
expect(view).toMatchObject({ moved: 1, deployed: 1, reserved: 1 });
expect(view!.units).toHaveLength(3);
```

- [x] 实现`formationChanges(current: readonly Unit[], plan: FormationPlan | null): FormationChangesView | null`。view包含moved/deployed/reserved以及units，每项包含id/kind/rank/from/to；复制位置，过滤未变者，按当前阵容顺序。
- [x] 实现`formationPositionLabel(position: Point | null): string`。覆盖同类实例、未动者、36格循环、所有错误/无方案、只读及坐标1基/备战席。

## 任务2：面板接入及交付

Files: 新`src/ui/FormationChanges.tsx`、`src/ui/formation-changes.css`；改`src/ui/FormationPresets.tsx`、README；新review文档。

- [x] 组件props为current与plan，调用纯投影，无结果返回null。显示总数与三项数量，details里逐只名称/阶数/编号、起止位置，并说明左上起点与完整小图。
- [x] 原面板以slot为key挂载组件；summary最小44px、清单可换行、局部CSS不影响旧页面，无新状态/effect。
- [x] React最佳实践、simplify复查；定向/全测试、build、显式startup-build、Prettier、空白检查。
- [x] game-playtest隔离保存、棋盘移动/备战换位、预览、应用、撤销；390/320展开/滚动/键盘/切槽截图；生产读原进度/空预设、返回刷新。记录实际边界。
- [x] README/review/计划更新；关闭自己的标签，恢复视口，停止自己的服务。新功能留工作区。
