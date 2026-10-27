# 试玩往返实施计划

**Goal:** 从独立试玩恢复正式战役，并能在结算打开集中试玩菜单。

**Architecture:** PlaytestLauncher以phase派生关闭文案，isolated控制正式返回；正式返回只导航pathname。ResultModal可选DEV回调，复用App现有弹窗state和焦点处理。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome/CUA。

**Spec:** `docs/superpowers/specs/2026-10-27-playtest-return-design.md`

按用户授权原生顺序实施、自审，不派代理；仅提交上一轮，本轮新开发不提交不推送。

## 约束与审查

- 不改规则数值、随机、三格、contentv24/schema2、loader、存档/fixture/素材、依赖或npm命令。
- 返回只使用pathname，不继承旧查询/hash；不把临时Session传给正式存储。
- 隔离才显示正式返回；无档或存储失败由现有loader处理。
- 关闭保持prepare/paused/result及奖励；结果入口不代替第8关专用动作。
- DEV生产边界、窄屏/焦点/滚动和明确离开提示均需验证。

## Task 1：返回语义与隔离回归

文件：`src/ui/PlaytestLauncher.tsx`、`PlaytestLauncher.test.tsx`、`playtest-scenes.test.ts`、`App.tsx`。

- [x] 先改测试调用为phase/isolated并验证三个返回文案、正式与隔离入口差异及不在渲染执行动作；观察失败。
- [x] 增加真实loader往返测试：建立合法正式检查点，进入五种场景并正常改变试玩，再移除查询重新加载，断言原主档字符串和检查点保持；无档新局/读取失败分支亦覆盖。
- [x] 将paused改为phase，使用模块内映射取关闭文案；isolated时增加提示和按钮，onClick只 `onNavigate(pathname)`。
- [x] App传phase及隔离标记；运行定向测试和类型检查。

## Task 2：结算入口与交付

文件：`src/ui/CampaignPanels.tsx`、`App.tsx`、`ranged-playtest.test.tsx`、`tools/startup-build.test.ts`、README及验收文档。

- [x] ResultModal可选onPlaytests，DEV且回调存在时显示“开发试玩”；App传DEV回调。真实第8关胜败SSR验证入口和原单关动作，缺回调无入口。
- [x] 生产构建字符串检查增加正式返回独有文案；全量测试、build及显式startup-build通过。
- [x] 按React最佳实践/simplify自审，game-playtest检查正常档往返、取消/暂停、结算菜单、320/390/短屏焦点与截图、生产和日志；恢复临时视口。
- [x] 更新README/验收文档并标完成；Prettier和diff检查通过，本轮新内容留工作区。
