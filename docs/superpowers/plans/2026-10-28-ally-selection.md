# 暂停灵兽筛选 Implementation Plan

> 按用户持续授权在本会话顺序实现、自审、验收，不派代理；新开发留工作区。

**Goal:** 在暂停详情中按种类与存活状态定位灵兽，准确处理空交集及快捷跳转。

**Architecture:** selectAllies只读消费battleInspection.allies，派生种类/状态计数、候选与具体选择；AllySelection提供受控原生select；BattleInspection管理筛选状态及跨入口清筛选/聚焦。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-ally-selection-design.md

## Global Constraints

保持规则/数值、RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖、默认命令。

## Review Focus

1. 倒下者保留记录，备战席不计，完整阵型与顶部统计不筛掉。
2. 空交集不能悄悄显示其他灵兽，筛选必须仍可恢复。
3. 同名不同阶/位置准确定位，改变筛选保留匹配编号。
4. 跨入口清筛选，阵型可定位倒下者，敌人跳转仍只允许存活者。
5. 档案往返保留筛选与暂停，普通切页恢复全部；320无横溢且可键盘操作。

## Task 1：模型与选择控件

**Files:** 新增src/ui/ally-selection.ts、src/ui/AllySelection.tsx、src/ui/ally-selection.test.tsx。

- [x] 先写并运行失败测试：真实battleInspection含同种不同阶、倒下者、备战席、缺记录、空/null；核对JSON只读及排序。
- [x] 实现selectAllies(allies,kind,status,selectedId)，种类全体计数、状态当前种类计数，返回空交集与有效selectedId。
- [x] 实现受控AllySelection，3个44pxselect、计数和空态；SSR核对选项计数、准确实例和空态无无效选择。

## Task 2：接入与验收

**Files:** 修改src/ui/BattleInspection.tsx、README.md；新增docs/reviews/2026-10-28-ally-selection.md。

- [x] BattleInspection添加kind/status状态和select ref；筛选事件使用模型选择，普通切页重置、图鉴往返保留；完整阵型/总数/备战说明不筛选。
- [x] 统一快捷定位入口先校验有效实例、清筛选，再选编号并聚焦；阵型允许倒下者，敌人仍只允许存活者。
- [x] simplify与React自审、定向测试/typecheck、全量、build及显式启动依赖检查、Prettier与diff检查。
- [x] Chrome隔离自然战斗验证种类/状态、空交集恢复、图鉴往返、阵型与敌人定位、键盘/焦点/暂停及390/320截图；清理临时页并只读核对正式档。
- [x] README与验收记录更新，完成计划勾选，本轮新增不提交。
