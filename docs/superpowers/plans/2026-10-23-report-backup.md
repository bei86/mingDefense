# 战报收藏备份实施计划

**Goal:** 玩家可把收藏战报备份并合并到另一浏览器。

**Architecture:** 新纯模块复用原readReports进行格式校验，计划预览与一次写入合并；独立折叠组件挂到ReportCollection，通用下载小函数与原ReportText共享。

**Tech Stack:** 现有React19/TypeScript/Vitest/Vite，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-report-backup-design.md`

## 约束和执行

当前会话顺序实现、自查，不委派。保留战役schema2、v24、规则、随机、素材、依赖及原命令。本步不提交、不推送。

## Review Focus

- 跨浏览器ID冲突：新条目重新编号，旧条目及原收藏时间保留。
- 预览后库改变：确认重读并拒绝过期预览，不覆盖其他页面新增。
- 文件读取时改文本/收起：请求序号使旧读取无效，输入状态有明确忙碌提示。
- 满库与坏库：整体拒绝、原库不动，重复项可无写入成功。
- HTML与UTF8：纯文本显示和字节上限，不以字符数替代大小。

## Task 1: 导入导出模型

- [x] 新增report-backup.test.ts先确认缺模块失败。构造原有效ReportSnapshot，并通过addReport生成收藏；验证导出到新临时端口后全文及createdAt一致。
- [x] report-backup.ts定义createReportBackup、inspectReportBackup、planReportImport、importReportBackup、readReportBackupFile。固定kind/schema、输入1MiB，复用readReports校验。
- [x] 预览保留目标库的规范序列签名；确认时重新生成计划并比较签名。保留旧记录，只为新增分配安全ID，全文去重；检查10条/768KiB；一次写入并捕获失败，重复不写。
- [x] 测试往返/乱序ID/重复/容量/版本/UTF8/恶意文件/坏库/读写失败/过期/其他键不变/文件读取失败与超限。

## Task 2: 界面和文件

- [x] 提取text-download.ts供ReportText和新组件共享，保持原Markdown下载行为。
- [x] 新增ReportCollectionBackup.tsx与局部CSS：默认折叠，导出文本及复制/JSON下载；粘贴或文件输入、校验、完整纯文本预览、确认及取消。只有展开挂载内容，文件读取通过ref序号失效处理。
- [x] ReportCollection.tsx接入，重读/删除/导入重置预览并刷新父列表，删除确认时隐藏备份区。
- [x] 按React最佳实践与simplify检查状态、异步竞争、组件边界。运行定向测试与typecheck。

## Task 3: 验收交付

- [x] game-playtest：隔离试玩库通过可见UI导入、取消、确认、重复及错误，导出复制/下载并回读；390/320截图、溢出/44px与弹窗滚动检查。
- [x] npm.cmd test、npm.cmd run build、CHECK_STARTUP_BUILD=1显式测试、Prettier和Git空白检查。
- [x] 生产构建恢复已有进度/收藏，检查新入口，不修改正式数据；检查控制台。
- [x] README/review记录证据，恢复视口、关闭本次标签、停临时服务。报告上一轮提交和本轮未提交结果。

文件选择器自动验收已尝试，受扩展文件URL权限限制；文件读取单测、JSON实际下载及粘贴回读通过，边界见review。
