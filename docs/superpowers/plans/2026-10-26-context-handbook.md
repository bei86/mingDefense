# 灵兽技能快捷查看实施计划

**Goal:** 从当前灵兽直接打开对应种类阶数图鉴，查完回到原界面。
**Architecture:** SpiritHandbook接收可选初始项；App保存图鉴打开参数，详情隐藏保持实例状态；选择解析复用sourceUnit。
**Tech Stack:** React19、TypeScript、Vitest、现有CSS。
**Spec:** `docs/superpowers/specs/2026-10-26-context-handbook-design.md`

## 约束与执行

用户已授权提交后继续开发，当前会话顺序实现，不使用子代理。本轮新功能留工作区，不推送。不改战斗/存档/数值/随机/依赖/原npm命令。

## Review Focus

- 已领取招募/扩地令/过期选择不能提供错误图鉴入口。
- 每次打开按来源初始化，图鉴内翻页不污染整备选择。
- 暂停详情必须保留选择且时钟冻结，只保留一个可见dialog。
- 隐藏详情不抢图鉴焦点，返回后Tab循环正常。
- 320宽快捷按钮和长名称不溢出，不阻挡棋盘。

## Task 1：定向图鉴与整备入口

Files: `SpiritHandbook.tsx`, `PreparationPanel.tsx`, 新建`context-handbook.test.ts`。

- [x] 新测试先失败：渲染八灵六阶初始项及默认鼠1阶；整备合法/过期来源显示正确入口。
- [x] 导出`HandbookTarget={kind:HeroId;rank:number}`，图鉴可选`initialEntry`及`closeLabel`，局部状态初始化，不加同步effect。
- [x] 整备复用`sourceUnit`取得合法来源，用名称阶数aria-label的按钮回调`onHandbook(target)`；沿用属性块样式。
- [x] 定向测试与TypeScript通过，输入Session不变。

## Task 2：暂停详情往返与焦点

Files: `BattleInspection.tsx`, `App.tsx`, `useModalFocus.ts`。

- [x] 暂停详情所选灵兽提供图鉴入口，支持倒下者；`suspended`只隐藏外层，保持组件挂载。
- [x] App图鉴布尔改为打开参数或null，全局默认鼠1阶，整备快捷带目标；详情保持inspection=true，图鉴关闭后回到详情。
- [x] `useModalFocus`沿原优先级选择可见dialog，避免挂载但隐藏的详情截取焦点。
- [x] 服务端渲染测试验证详情目标及隐藏属性，浏览器验证真实返回同实例/时钟/Tab焦点。

## Task 3：验证与交付

- [x] 全量测试、build、构建后启动依赖检查、Prettier、diff空白检查。
- [x] 隔离试玩、320/390宽截图、控制台；生产只读恢复。
- [x] 按game-ui/game-playtest/React/simplify检查，README与review记录证据；恢复视口、关闭自建页、停服务，新开发不提交。
