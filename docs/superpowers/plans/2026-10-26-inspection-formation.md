# 暂停阵线总览实施计划

**Goal:** 在暂停详情中用完整占格阵型直接点选灵兽并查看当前状态。
**Architecture:** InspectionFormation默认折叠，展开后渲染无状态InspectionFormationBoard；复用battleInspection投影，由父组件唯一unitId控制选中。
**Tech Stack:** React19、TypeScript、Vitest、CSS，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-26-inspection-formation-design.md`

## 全局约束

当前会话顺序执行，不用子代理；新功能不提交、不推送。不改战斗规则/数值、schema2/contentv24、随机流、3格接敌、依赖及原npm命令。

## Review Focus

- 多格占位不透明覆盖全部底格，任一位置命中同一按钮。
- 同种不同ID分别选中，地图与下拉使用同一个选择源。
- 倒下和存活按真实生命，锁定来自存活敌人；不预测攻击。
- 旧战报缺失和备战不影响当前站位，空数组安全。
- 窄屏图不溢出，保留下拉44px入口；图鉴返回仍暂停并保留选择。

## Task 1：总览图与语义

Files: 新建`src/ui/InspectionFormation.tsx`、`src/ui/inspection-formation.css`、`src/ui/inspection-formation.test.ts`。

- [x] 写失败测试：roster真实开战投影八灵样式占格与cells一致；选择aria-pressed；倒下可选及真实敌人锁定；备战与缺报告；空阵容和只读。
- [x] 运行`npx.cmd vitest run src/ui/inspection-formation.test.ts`确认缺模块失败。
- [x] 实现`InspectionFormationBoard({allies,selectedId,onSelect})`：固定6×6格背景，英雄shape计算span；按钮完整占格，ID key、选中、生命条、锁N/伤、可访问完整标签；当前选择反馈及边界说明。
- [x] 实现`InspectionFormation`：原生details默认收起，仅展开时绘图；空数组不显示。独立CSS限域、实心占位、不加动画。
- [x] 定向测试与TypeScript通过。

## Task 2：详情组合

Files: 修改`src/ui/BattleInspection.tsx`。

- [x] 灵兽tab中、下拉之前接入`<InspectionFormation allies={view.allies} selectedId={unit?.id} onSelect={setUnitId} />`；现有下拉不变。
- [x] 浏览器证明地图点选与下拉同步，选择新实例重置属性、图鉴返回保留图与选择；暂停不推进。
- [x] 按React与simplify检查：状态不复制、无effect、只展开时渲染、不跨功能抽象。

## Task 3：验证和交付

- [x] 全量test与build；构建后显式startup检查。
- [x] Edge隔离roster试玩、键盘、320/390宽、截图和控制台；正常生产首屏只读恢复。
- [x] README和review记录证据及局限，Prettier和diff空白检查；清理自建页/服务、恢复视口。本轮留工作区。
