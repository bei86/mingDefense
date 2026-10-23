# 战报复制与导出实施计划

**Goal:** 玩家在结算页主动复制或下载完整本场战报，保留复盘证据。
**Architecture:** 纯函数将Session终局投影为Markdown，局部React折叠区负责浏览器复制/下载；只传来源标签，不写新存储。
**Tech Stack:** TypeScript、React19、Vitest、原生Clipboard/Blob API，无依赖变化。
**Spec:** `docs/superpowers/specs/2026-10-23-report-export-design.md`

## 约束与执行

沿用用户授权的当前会话顺序执行，不派子代理，不重复确认。仅提交上一轮，本轮新实现留待体验；保持v24/schema2、规则/数值/RNG、存档、默认命令和原结算操作不变。

## Review Focus

失败不能把上次lastReward误导为本次收入；恢复胜利多次导出不能重复结算；旧逐兽缺失不能变成0；开发试玩不得伪装正式进度；窄屏和剪贴板失败仍需可手动保存。

## 任务1：只读终局格式与测试

**Files:** 新src/ui/battle-report-export.ts、src/ui/battle-report-export.test.ts。

**Interface:** `battleReportDocument(session: Session, isolated: boolean): {fileName: string; text: string} | null`。只读当前终局，用战斗stageId、result及已结算字段，不调用结算、命令或exportSave。

- [x] 先写测试并确认缺模块失败。用正常Session.transfer部署鼠/豚/隼，start后tick，并在hasChoices时chooseBuff，直至真实胜利；逐项对照真实报告，不只快照文本。示例：

```ts
const before = structuredClone(session.preparation);
const document = battleReportDocument(session, false)!;
expect(document.text).toContain(`通关 ${session.lastReward}`);
expect(session.preparation).toEqual(before);
```

- [x] 实现终局守卫及格式，缺字段统一「未记录」；逐兽按伤害/ID稳定排序，备战及结束累计天赋单列。失败只显示未保留收入，不使用last字段。
- [x] 覆盖恢复/多次导出、非法阶段与待选择、失败、隔离标记、旧逐兽/盾/聚灵字段、位置与备战、天赋、时间和源对象不变。运行针对性测试及typecheck。

## 任务2：结算入口与浏览器操作

**Files:** 新src/ui/ReportExport.tsx、src/ui/report-export.css；修改src/ui/CampaignPanels.tsx、src/ui/App.tsx。

- [x] Props为`session:Session, isolated:boolean`；details默认收起，仅展开时生成文档。文本框只读且可手动选择，按钮点击才执行复制或下载，复制中禁用重复提交。
- [x] 下载采用UTF-8 text/markdown Blob、URL.createObjectURL、a.download并点击，随后延迟revoke；异常提示用下方文本手动保存。复制异常保持文本，提示手动全选，不操作战役。
- [x] ResultModal只新增isolated参数与ReportExport；App传`boot.isolated ?? false`。新CSS适配320短屏、文本换行和焦点边框，不增加模态或改变原按钮。
- [x] 按simplify局部复查、Prettier，完整test、build、显式startup-build检查。

## 任务3：验收与交付

- [x] game-playtest独立开发/生产端口，合法首战完成后展开/复制/下载；无注入游戏状态。验证手动文本全选、复制成功反馈和下载发起反馈。
- [x] 验证文本键盘选择、折叠与继续下一关，生产报告来源与刷新结果恢复；截图及控制台记录。
- [ ] 浏览器下载文件逐字核对及390/320实际布局复核：工具未取得下载事件，视口设置未生效，详见下方限制。
- [x] 更新README及docs/reviews/2026-10-23-report-export.md。恢复视口、关闭自己的标签、停止自己的服务，Git空白检查；新功能不提交不推送。

## 验收限制

代码及自动验证完成，浏览器覆盖合法首战、复制反馈、手动全选、刷新与下关；下载事件未取得文件，下载记录页被工具策略阻止，视口控制未实际生效。下载文件及390/320真实窄屏检查待复核，不能视作通过。详情见验收文档。
