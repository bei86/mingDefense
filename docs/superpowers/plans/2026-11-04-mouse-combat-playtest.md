# 烬灵鼠实战动作对照实施计划

**Goal:** 在既有开发试玩中提供可重复的真实烬灵鼠动作检查场景。

**Architecture:** 新增仅开发版固定开局Session子类，只负责重置和单关限制，战斗本身沿用正常模拟。通过现有loadBrowserSession隔离加载，App复用Battlefield、暂停、显示设置和结算。当前会话原生实施，不派生子代理，新开发留待下次提交。

**Tech Stack:** TypeScript、React、Phaser、Vitest；无新增依赖。

**Spec:** docs/superpowers/specs/2026-11-04-mouse-combat-playtest-design.md。

## Global Constraints

- 不修改战斗规则、伤害、冷却、仇恨、三格接敌、RNG算法与存档字段。
- 人工阵容只用于动作检查，不能表述为正常经济路线或最终平衡验收。
- 试玩必须在正式存储读取前分流，生产构建剔除入口和固定数据。
- 目视通过必须来自浏览器画面，测试/HTTP通过仅报告对应证据。

## Review Focus

1. 前排倒下后其他单位仍存活，给重伤动作留出播放时间；用真实模拟测试验证。
2. 结算、暂停菜单与重置不误导玩家进入下一关；测试nextStage拒绝且状态不变和结算无推进按钮。
3. 失败重试/胜利后回整备不能带入临时收益；比较重置开局完整exportSave。
4. 带旧查询、嵌套pathname与正式存储不可访问环境；复用目录隔离和返回正式档测试。
5. 生产包不含固定阵容种子或实战入口；扩展startup-build检查。

## Task 1: 固定开局与真实表现测试

Files: src/game/fixtures/mouse-combat-playtest.ts、mouse-combat-playtest.test.ts。

Interfaces: `mouseCombatPlaytest(): Session`；重置恢复固定开局，retry重置再start，nextStage返回单关提示。

- [x] 先写测试并确认新模块缺失失败。
- [x] 固定种子与双鼠位置，原始第1关敌群；通过真实模拟确认所有动作和前后排观察条件。
- [x] 比较暂停、速度、重复读取前后的状态；覆盖重置、重试和禁止推进。

## Task 2: 试玩入口及说明

Files: src/ui/useSessionStorage.ts、playtest-scenes.ts及测试、PlaytestLauncher.test.tsx、MotionPreview.tsx及测试；新增MouseCombatPlaytest.tsx、mouse-combat-playtest.css和测试；修改App.tsx。

- [x] 新增目录id `mouse-combat`，启动在正式存储前返回blocked/isolated。
- [x] 布阵/战斗折叠说明与结算重置入口复用同一组件，pathname只由调用方提供。
- [x] 修正样板开局、重置确认及暂停重置文案，结算复用trialActions隐藏推进；保持其他场景行为。
- [x] 加入素材预览到实战的直接链接；扩展SSR与目录隔离/返回正式档测试。

## Task 3: 验证与交付

Files: tools/startup-build.test.ts、README.md、docs/reviews/2026-11-04-mouse-combat-playtest.md。

- [x] 定向测试、typecheck、全量测试、构建、CHECK_STARTUP_BUILD=1、格式和diff检查。
- [x] 开发服务入口和相关模块HTTP核对；浏览器工具有阻塞则明确记录未做视觉验证。
- [x] 按simplify复核状态边界、重复逻辑与原正式流程；说明人工样板与真实战役区别。
- [x] 2026-11-05用户实测反馈“可以”；代理端浏览器截图、窄屏和完整交互验收仍未完成，范围见验收记录。
