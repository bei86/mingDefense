# 敌人有效状态筛选 Implementation Plan

> 用户持续授权本会话自主实施、自审、验收；不派代理，新开发留待下次提交。

**Goal:** 在暂停详情按当前局部状态筛选敌人。

**Architecture:** enemyInspection在现有效期判断中生成类型化statuses；selectEnemies在种类过滤后统计和筛选，再调用原排序。EnemyInspection维护本次查看条件，EnemySelection展示控件与空态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-status-filter-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖与默认命令。

## Review Focus

1. 重叠状态不互斥，计数不可误相加；全场迟滞不冒充霜尾缓行。
2. 精确到期、缺失倍率和0倍率沿用原详情语义，不看翻译标签决定分组。
3. 编号0、同种实例、失配及空交集，控件留在界面且无错误详情/档案。
4. 档案返回保留状态，衍生跳转清过滤仍保排序，普通切页重置。
5. 无活敌仍为原空态；浏览器键盘/窄屏/暂停时钟不回归。

## Task 1：投影与选择

**Files:** src/ui/enemy-inspection.ts、enemy-selection.ts、新enemy-status-filter.test.tsx，enemy-selection.test.ts仅扩展空对象期望。

**Interfaces:** EnemyEffectStatus=frozen|slowed|vulnerable；InspectedEnemy.statuses数组；EnemyStatusFilter额外含all/unaffected；selectEnemies第五参status默认all，模型增加status/counts。

- [x] 真实Combat与SSR测试覆盖Review Focus1–3/5，先失败后实现；statuses与effects同条件写入。
- [x] 状态计数基于matchingKind，匹配判断复用statuses.includes；unaffected仅statuses为空，默认旧调用不变。

## Task 2：控件与生命周期

**Files:** EnemySelection.tsx、EnemyInspection.tsx，旧EnemySelection测试补onStatus回调。

- [x] 状态控件添加分组计数和重叠/迟滞说明；空交集保留种类/状态/排序，隐藏实例和导航。
- [x] EnemyInspection新增status查看状态，种类/状态变化共用changeFilter；无活敌与空交集分别渲染，enemy存在才有详情/档案；关联跳转清status。
- [x] 定向测试、TypeScript及React/simplify自审通过；不新增effect/持久化/引擎状态。

## Task 3：验证与文档

**Files:** README.md、docs/reviews/2026-10-28-enemy-status-filter.md。

- [x] 全量测试、build、显式启动边界、Prettier/diff检查。
- [x] 独立试玩验证档案返回/切页/键盘/窄屏/暂停，保存并目视320/390截图，检查控制台；清理试玩与临时视口，不推进正式战役。衍生跨状态跳转未捕获存活样本，列入验收边界。
- [x] 更新README/验收/计划，报告边界，新开发留工作区。
