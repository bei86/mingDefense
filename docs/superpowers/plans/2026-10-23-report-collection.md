# 战报收藏实施计划

**Goal:** 手动收藏最多10份结算战报，跨关卡/刷新复盘，复用文本复制下载。

**Architecture:** StoragePort隔离独立收藏库，纯快照不含Session。列表弹窗按需读取；抽出共享ReportText，原导出功能与收藏详情共用。

**Tech Stack:** TypeScript、React19、Vitest、现有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-report-collection-design.md`

## 执行与约束

沿用连续开发授权，在当前会话顺序实现，无子代理，不另开确认；本轮新代码不提交不推送。v24/schema2、核心规则/RNG/素材/依赖/默认命令保持。

## Review Focus

1. 结算之前不产生收藏；失败不能复制旧last收入。用真实Session胜败快照验证。
2. 坏库和配额失败不得覆盖旧数据或报成功。验证unknown schema、无效记录、字节限制、get/set异常。
3. 满10个不能静默删旧；重复收藏无写入，删除只针对指定ID。验证重读其他页面变更。
4. 隔离分支所有操作只访问内存StoragePort。禁用真实浏览器存储的探针测试。
5. 查看/删除收藏不改Session，暂停关闭不恢复，原导出文档兼容。用快照对照、旧导出测试和浏览器验证。

## 任务1：收藏快照与存储

**Files:** 新`src/ui/report-collection.ts`、`src/ui/report-collection.test.ts`。

- [x] 先写真实Session完成首战后快照、保存读取与Session不变测试，运行确认缺模块失败。

```ts
const before = JSON.stringify(session);
const snapshot = reportSnapshot(session, false)!;
expect(addReport(storage, snapshot, 1000).error).toBeNull();
expect(readReports(storage).entries[0].document).toEqual(snapshot.document);
expect(JSON.stringify(session)).toBe(before);
```

- [x] 实现`ReportSnapshot`/`CollectedReport`/`ReportLibrary`，纯函数`reportSnapshot`、`readReports`、`addReport`、`removeReport`；`temporaryReportStorage`返回独立Map-backed StoragePort。按schema/UTF8字节/字段/ID/文本重复验证，写前重读、失败返回当前有效列表及说明。
- [x] 验证真实失败、未结算、跨刷新、文档副本、内容去重、满库、删除、损坏/配额保留、隔离；运行新测试及typecheck。

## 任务2：收藏与复盘入口

**Files:** 新`ReportText.tsx`、`ReportCollection.tsx`、`report-collection.css`；改`ReportExport.tsx`、`report-export.css`、`App.tsx`、`CampaignPanels.tsx`、`CombatPanels.tsx`、`combat.css`。

- [x] 共享ReportText保留原复制/下载/手动全选行为，附可选收藏动作。ReportExport只在展开时构建文档，收藏失败保留当前文本。
- [x] 列表原生select选择、空状态、只读文本、刷新及两步删除；满库说明不淘汰。隔离模式明显注明刷新清空。打开/关闭收藏加入原模态焦点上下文，暂停菜单不与收藏重叠；整备底部与结算提供入口。
- [x] 浏览器存储对象按GameApp生命周期创建，不在战斗tick读取；正常用browserStorage，隔离用temporaryReportStorage。结算组件传递共享storage，不写战役。
- [x] React最佳实践/simplify复查；Prettier、新旧战报及存储定向测试、完整test、build及显式startup-build检查。

## 任务3：验收与交付

- [x] game-playtest开发首战收藏去重、下一关查看；生产第2关收藏、进入第3关及刷新保留；隔离空/临时保存、删除取消和确认；暂停打开关闭仍暂停。
- [x] 核对390/320实际DOM尺寸、滚动和键盘焦点，截图、查控制台；最终生产包复核正常存档恢复和收藏读取。
- [x] README与review写明存储边界、已验证/未验证范围；清理自己的服务/标签/临时视口；Git空白检查，新功能留在工作区。
