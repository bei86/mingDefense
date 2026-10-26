# 战报复制等待恢复实施计划

**Goal:** 让共用战报复制不因剪贴板无响应永久禁用，并提供明确可用的手动选择路径。

**Architecture:** 纯TypeScript函数封装原生写入的超时和逻辑取消；ReportText按正文隔离内部组件状态，AbortController与ref防止旧结果回写。当前授权原生顺序执行、自审；不派代理、不重复审批。

**Tech Stack:** React19、TypeScript、Vitest假时钟、Vite、Chrome页面验收。

**Spec:** `docs/superpowers/specs/2026-10-26-report-copy-design.md`

## 全局约束与审查重点

- 上一轮733442d已提交。本轮新开发不提交、不推送；不新增依赖，不改正式数值、contentv24/schema2、规则、资产和npm命令。
- 保留用户激活：writeText在调用函数时同步执行；未成功不得显示已复制。
- 超时后释放按钮，迟到resolve/reject不能覆盖后续动作；逻辑取消不保证撤回平台写入。
- 卸载或文档正文变化不更新旧组件；重复点击不并发；手动选中、下载、收藏取消旧等待。
- 全选范围完整、只读不变、按钮aria-controls与textarea关联、窄屏44px目标；不把自动化剪贴板回读当作成功的前提。

## Task 1：有界复制

文件：新建 `src/ui/report-copy.ts`、`src/ui/report-copy.test.ts`。

- [x] 先写测试并确认缺模块失败：`copyReportText(text, signal, writeText?)`同步调用写入，返回四种结果。
- [x] 实现5000ms超时、try捕获同步异常、Promise拒绝、abort提前结束，清理定时器和监听。
- [x] 假时钟测试永久挂起、临界4999/5000ms、迟到成功/拒绝、取消及清理，确保无自动重试。

## Task 2：报告操作接线

文件：修改 `src/ui/ReportText.tsx`、`src/ui/report-export.css`；新增 `src/ui/ReportText.test.tsx`。

- [x] 外层ReportText渲染正文key的内部内容，卸载时取消旧等待。
- [x] 复制使用ref和AbortController限制并发，映射四态提示；手动选择、下载、收藏先清除旧等待。
- [x] 新增「选中文本」按钮，focus/select/setSelectionRange；aria-controls关联只读textarea，新按钮全行且44px。
- [x] SSR确认原文完整、textarea只读、按钮及关联存在；类型与定向测试通过。按React最佳实践/simplify自审，避免无关重构。

## Task 3：验收交付

- [x] 实际游玩至报告可用，验证复制状态、手动全文选择、下载、折叠重开及键盘，390/320截图和日志，恢复视口。
- [x] 全量测试、build、显式startup-build、格式与diff检查；生产实际正常入口检查。
- [x] README和 `docs/reviews/2026-10-26-report-copy.md` 写清证据与限制，更新勾选，新开发留工作区。
