# 战前检查实施计划

**Goal:** 在不打断开战的前提下检查当前上阵及尚可利用的备战/招募。
**Architecture:** 纯只读模型复用规则验证器，React默认折叠面板只回调现有choose，PreparationPanel负责接入。
**Tech Stack:** TypeScript、React19、Vitest、现有Vite，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-23-preparation-check-design.md`

## 执行与约束

按用户持续授权在当前会话顺序执行，不派子代理、不重复申请审批。本轮仅提交上一轮；新功能留待体验。保留v24/schema2、数值/RNG、默认命令、拖放、开战条件、存档及撤销。

## 重点复查

碎片空格不能算合法多格落点；备战和招募不能计入参战生命或输出；已领取招募不能重复列出；最高阶与未领取双招募不能误报可合成；点击选中不能消费或二次取消选择。

## 任务1：只读检查模型与事务对照

**Files:** 新`src/ui/preparation-check.ts`、`src/ui/preparation-check.test.ts`。

**Interface:** `preparationCheck(p: Preparation, maxRank: number): PreparationCheckModel`；模型含deployedCount/attackerCount/deployedHp/emptyCells/items，item含source/kind/rank/origin/placements/mergeTargets。kind是HeroId或cell，rank为number或null，origin为reserve或offer。

- [x] 写有意义的规则对照测试，先验证新模块缺失失败。首战鼠12/豚9/隼6落点固定断言；其他八灵逐一对照每格真实transfer结果，不只复制公式。示例：

```ts
const s = new Session();
const before = structuredClone(s.preparation);
const check = preparationCheck(s.preparation, s.maxRank);
expect(check.items.map((item) => item.placements)).toEqual([12, 12, 9, 6]);
expect(s.preparation).toEqual(before);
```

- [x] 模型枚举config.board边界内锚点，调用placementError或expansionError；合成目标用mergeError，排除自身/已领取/上限。用cells/key统计完整占格，maxHeroHp只累计有position的单位，hitDamage>0计输出。
- [x] 覆盖碎片空格、生命天赋、辅助/备战、上限、满棋盘可合成、扩地、已领取招募、读模型后实际合成和精确撤销。运行`npx.cmd vitest run src/ui/preparation-check.test.ts src/ui/merge-preview.test.ts src/ui/first-battle-guide.test.ts`及typecheck。

## 任务2：默认折叠面板

**Files:** 新`src/ui/PreparationCheck.tsx`、`src/ui/preparation-check.css`；修改`src/ui/PreparationPanel.tsx`。

**Interface:** Props为`session: Session, selected: Source|null, choose: (source:Source)=>void, fieldReady:boolean`。

- [x] 原生details/summary维护本页expanded；只有展开时构建完整模型，按reserve/offer分组。统计和说明不使用胜率或DPS措辞，来源按钮以aria-pressed表示选中，未就绪禁用。
- [x] 选择回调：

```ts
if (!chosen) choose(item.source);
```

- [x] 接在原prepare-actions之前。原开始守阵onStart不变，无新增弹窗、自动部署/合成或保存。CSS沿用森林/金色主题，行可换行，短屏使用页面正常滚动。
- [x] 依simplify局部复查、Prettier；执行针对性测试、全套测试、build、显式startup-build检查。

## 任务3：浏览器与交付

- [x] game-playtest使用独立端口/标签：隔离首战验证折叠与选择不消费，真实部署/暂存/合成/撤销后即时更新、战斗和暂停隐藏；生产地址真实部署后刷新恢复。无注入游戏内部状态。
- [x] 390×844及320×568查看长列表、Tab/Enter展开和选择、无横向溢出，保存代表性截图及控制台记录。使用浏览器插件；没有可用浏览器时记录具体限制。
- [x] 更新README及`docs/reviews/2026-10-23-preparation-check.md`，标明检查范围、测试结果、浏览器证据与限制。恢复视口、关闭自己的标签并停止自己的服务；`git -c core.safecrlf=false diff --check`，确认上一轮提交与本轮未提交状态。
