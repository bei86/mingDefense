# 文本导出统一恢复实施计划

**Goal:** 四个独立导出入口统一获得有界复制和全文选择。

**Architecture:** 从ReportText提取TextExport，复用copyReportText和原CSS；宿主保留数据生成、导入及下载契约。按本会话授权原生顺序实现、自审，不派代理、不重复审批，新开发不提交。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome。

**Spec:** `docs/superpowers/specs/2026-10-26-text-export-design.md`

## 全局约束和审查重点

- 不改contentv24/schema2、数值、战斗、三格距离、资产、依赖及npm命令。
- 同步触发Clipboard，5000ms未确认恢复按钮；不声称撤回平台写入。
- 正文替换/卸载不接收旧结果，同正文的重新生成存档和诊断捕获也重置等待。
- 操作提示与导入提示独立；保留生成下载时新建当前备份的行为，阵型不新增下载。
- 关联只读textarea，完整选择，多实例ID独立；窄屏至少44px操作目标。

## Task 1：共用导出组件

- [x] 将ReportText的状态、AbortController、复制、手动选择与取消提取到 `src/ui/TextExport.tsx`。接口：`text/label/copyLabel/copiedNotice/download?:{label,run:()=>string}/onCollect?:()=>string`。
- [x] ReportText保留BattleReportDocument接口和原下载/收藏文案，委托TextExport；不引入新的包或状态框架。
- [x] 新增 `src/ui/TextExport.test.tsx`：`renderToStaticMarkup(<TextExport text={'中文\n<>&'} label="备份" copyLabel="复制备份" copiedNotice="已复制" />)`，断言转义准确、readonly、aria-controls、无下载；两实例及带下载/收藏变体验证ID独立。
- [x] 运行 `npx.cmd vitest run src/ui/TextExport.test.tsx src/ui/ReportText.test.tsx src/ui/report-copy.test.ts` 和typecheck。

## Task 2：四入口接线

- [x] SaveManager、FormationShare、ReportCollectionBackup、PerformanceReport用TextExport替换各自直接Clipboard等待。导入源码及文件契约不改。
- [x] SaveManager生成备份递增版本；PerformanceReport捕获递增版本，不因复制禁用捕获。
- [x] 按React规范及simplify自审diff，确认旧直接Clipboard调用仅留底层函数。

## Task 3：验证交付

- [x] 使用game-playtest技能浏览器检查存档、隔离阵型、临时收藏、DEV诊断，验证准确全文选择及下载；390/320窄屏截图，恢复视口。
- [x] 全量测试、build、显式startup-build、prettier与diff检查。
- [x] 更新README和 `docs/reviews/2026-10-26-text-export.md`，勾选已完成步骤；新开发留工作区。
