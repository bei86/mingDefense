# 暂停快照累计贡献 Implementation Plan

> 延续当前会话原生顺序实施、自审、验收，不派代理，新开发留工作区供下一轮提交。

**Goal:** 使暂停快照同时包含全体上阵逐兽累计贡献及有缺失语义的五项合计。

**Architecture:** snapshot-contributions.ts读取InspectedAlly.stats，复用reportValue与reportContribution生成章节；battle-snapshot.ts接入、BattleSnapshot只更新介绍。

**Tech Stack:** TypeScript、React19、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-snapshot-contributions-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、素材、存档/收藏/备份、依赖、默认命令及快照门禁/文件名/来源。不推送、不提交本轮新实现。

## Review Focus

1. 缺字段/缺行/无报告不冒充0或完整总数，完整指标独立有效。
2. 倒下者仍计、编号0与同名不混淆、备战及无关report行排除。
3. 原始值求和后取整，与逐行取整之和不同必须明确说明。
4. 记录非当前生命、当前护盾或本关总收入，不回算且不承诺终局结果。
5. 站位稳定、筛选与页签无关，重复读取不改变Session、数组和RNG。

## Task 1：章节与测试

**Files:** 新增src/ui/snapshot-contributions.ts、src/ui/snapshot-contributions.test.tsx；修改src/ui/battle-snapshot.ts、src/ui/BattleSnapshot.tsx。

**Interfaces:** snapshotContributionLines(battle:Combat,units:readonly InspectedAlly[]):string[]；保持battleSnapshotDocument原签名。

- [x] 写集成测试：真实Combat产生五项记录，逐实例映射；同名/0/倒下/备战；缺字段/行/报告与非法值；0和空阵线；小数合计、站位顺序、只读、SSR。运行确认旧快照缺章节失败。

```ts
const text = battleSnapshotDocument(session, true)!.text;
expect(text).toContain('## 本关累计贡献');
expect(text).toContain('未记录（缺1只记录）');
```

- [x] 创建独立章节函数，复用reportMetrics/reportValue与reportContribution，接入上阵生命表后。按缺值判定格式化，无新统计算法。

```ts
const entry = unit.stats ? { id: unit.id, ...unit.stats } : null;
const value = entry ? reportValue(entry, metric) : null;
const total = reportContribution(battle, metric);
```

- [x] 更新导出介绍；定向snapshot-contributions、battle-snapshot、snapshot-actions、snapshot-summons、report-contribution及typecheck，React/simplify自审。

## Task 2：验收与文档

**Files:** 修改README.md；新增docs/reviews/2026-10-28-snapshot-contributions.md。

- [x] 全量test/build与CHECK_STARTUP_BUILD=1启动检查；Prettier、git diff --check。
- [x] 独立stage50自然开战暂停，对照当前贡献与导出，验证筛选/切页/关闭重开、实际390宽度及全文选择；保存截图、恢复视口并关闭试玩，正式页只读核对。记录未覆盖边界。
- [x] 更新README和验收记录，勾选计划，新开发留工作区。

```powershell
npx.cmd vitest run src/ui/snapshot-contributions.test.tsx src/ui/battle-snapshot.test.tsx src/ui/snapshot-actions.test.tsx src/ui/snapshot-summons.test.tsx src/ui/report-contribution.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
