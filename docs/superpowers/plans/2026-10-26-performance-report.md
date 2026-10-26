# 手机试玩诊断报告实施计划

**Goal:** 为手机前台试玩提供可手动捕获、复制和下载的性能诊断快照。

**Architecture:** 沿用有界FrameMetrics；开发面板按上下文重置窗口，每秒生成只读快照。独立纯投影生成报告，React只处理用户事件，不增加逐帧渲染或持久化。

**Tech Stack:** TypeScript、React19、Vitest、Vite、CSS、CUA Edge。

**Spec:** `docs/superpowers/specs/2026-10-26-performance-report-design.md`

## 全局约束与审查重点

不修改模拟/数值、RNG、schema2/contentv24、3格接敌、存档、战报/收藏格式、素材、依赖或既有npm命令。本轮新增内容留工作区，不推送；当前会话顺序实施、自审。

- 暂停/天赋/倍速/跨关/隐藏/尺寸变化不得导出旧上下文样本。
- 无采样时不生成零FPS或虚假报告；最近120帧不等于整局均值。
- 捕获固定文本，不读写Session，不带URL/IP/存档/种子。
- 复制/下载失败提供明确反馈和手动文本，不自动上传。
- 两列按钮44px，320宽不横溢，生产没有诊断入口和文案。

## Task 1：采样与报告模型

- [x] 新增 `src/render/performance-report.test.ts`，使用 `performanceContext(session)`、`PerformanceWindow`、`performanceReport(sample, userAgent)`；验证无样本、状态/暂停/选择/倍速转换、重置、真实慢帧、有界窗口、报告完整性及只读。
- [x] 运行新测试确认缺模块失败，再新增 `src/render/performance-report.ts`：上下文、包裹FrameMetrics的采样窗口、明确快照类型及 `{text,fileName}` 文档生成。

## Task 2：开发面板接入

- [x] 新增 `src/render/PerformanceReport.tsx`，props为 `readSample:()=>PerformanceSample|null`、`onReset:()=>void`，捕获固定报告、手动选择文本、复制及下载；捕获失败清除旧报告，不让旧报告冒充新结果。
- [x] 新增 `src/render/performance-report.css`，44px按钮、可换行说明与只读文本框。
- [x] 修改 `Battlefield.tsx`：替换局部FrameMetrics实例为PerformanceWindow，按实际上下文记录；每秒保存明确快照并更新原output；失焦/resize/清理时重置。readSample校验当前上下文和可见性，开发条件下显示组件。
- [x] 新测试、FrameMetrics测试、typecheck通过；按React/simplify检查事件读ref、无逐帧setState、无新存储/计时器。

## Task 3：验收

- [x] 全量测试、生产build、显式startup-build检查；生产代码扫描排除诊断文案。
- [x] Edge独立试玩开perf：捕获、固定文本、重采样、开战/暂停/倍速上下文、320/390窄屏、复制/下载、截图与控制台；生产页附perf仍无入口。
- [x] README补直接可用的手机步骤及诊断边界，验收文档记录实际证据和未测真机；Prettier、Git空白检查，恢复视口、关闭自建页并停止服务。
