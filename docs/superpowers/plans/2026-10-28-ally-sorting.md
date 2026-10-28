# 暂停灵兽排序 Implementation Plan

> 用户持续授权在本会话实施、自审和验收，不派代理，新开发留工作区。

**Goal:** 按暂停战况与本关贡献排列筛选后的灵兽，保留准确选择。

**Architecture:** ally-sorting纯函数定义指标、排序和显示；selectAllies增加可选order参数，过滤后复制排序；AllySelection受控排序入口，BattleInspection管理order事件和导航生命周期。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-ally-sorting-design.md

## Global Constraints

保持规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖、默认命令。

## Review Focus

1. 生命比较比例，倒下0先于残血；异常值不能变成最小值。
2. 旧贡献缺失排真实0后，浮点排序不提前取整。
3. 同值按行列ID，输入数组不变，完整阵型与统计不重排。
4. 改排序不改实例；筛选空态、失效编号按有效候选确定选择。
5. 图鉴保留、普通切页恢复、快捷定位准确；320长选项无横溢。

## Task 1：纯排序与选择

**Files:** 新增src/ui/ally-sorting.ts、src/ui/ally-sorting.test.tsx；修改src/ui/ally-selection.ts。

- [x] 先写失败测试：真实battleInspection的比例/倒下/锁定/贡献、同值、缺记录、部分字段、浮点、非有限/空、JSON只读。
- [x] sortAllies复制排序，allySortLabel仅格式化；selectAllies(...,order='position')过滤后排序并保留匹配编号，统计沿用全投影。

## Task 2：入口与验收

**Files:** 修改src/ui/AllySelection.tsx、src/ui/BattleInspection.tsx、README.md；新增docs/reviews/2026-10-28-ally-sorting.md。

- [x] 受控排序select、非默认指标文案、空态保留，SSR核对选项/旧字段/默认兼容。
- [x] BattleInspection本地order状态：筛选沿用order，改排序保留编号，普通切页重置，快捷定位不覆盖目标，图鉴挂起保留。
- [x] simplify/React自审，定向/typecheck、全量、build和显式启动依赖、Prettier与diff检查。
- [x] Chrome隔离第50关自然暂停核对生命/锁定/贡献、筛选/图鉴/快捷定位/切页、390/320截图与键盘；恢复视口、清理试玩并核对正式档。
- [x] README和验收记录，计划勾选，新开发不提交。
