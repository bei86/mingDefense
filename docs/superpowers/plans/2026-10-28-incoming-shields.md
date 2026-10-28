# 灵兽准备施盾来源 Implementation Plan

> 用户持续授权当前会话自主实施、自审和验收；不派代理，新开发留待下次提交。

**Goal:** 在受盾灵兽详情查看真实施盾准备来源并双向定位。

**Architecture:** incomingShields只读Combat的己方准备队列，IncomingShields复用折叠/链接样式；BattleInspection使用现有showAlly定位，无额外目标状态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-incoming-shields-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 队列中的施盾目标不同于范围或下次选盾，不把普通攻击/敌方同号动作当成施盾。
2. 自施盾、同名多狐、来源/目标编号0与重复动作精确保留。
3. 到期/1ms显示正确，不重算预计盾量；读取和返回对象不改队列或来源站位。
4. 目标/来源倒下、退场、备战、无数据以及已释放动作不列入。
5. 来源与目标双向定位、筛选/排序与焦点保持符合原交互，窄屏可读、键盘可用。

## Task 1：模型和列表接入

**Files:** 新增src/ui/incoming-shields.ts、IncomingShields.tsx、incoming-shields.test.tsx；修改BattleInspection.tsx。

**Interfaces:** `incomingShields(battle:Combat|null,unitId:number):IncomingShield[]`，记录source的id/kind/rank/position、ordinal与remainingMs；IncomingShields接收actions和onSelect(id)。

- [x] 写真实准备/释放、边界、同名/0编号/重复/自施盾、失效对象、排序和快照只读、SSR空/收起/接入测试，运行确认缺失模块失败。
- [x] 实现存活目标检查、存活狐Map、team/target/source过滤、due/source/ordinal排序与独立站位快照。
- [x] 实现按需渲染折叠名单、准确来源标签与空/边界说明；BattleInspection按unit.id重置并复用showAlly。
- [x] 定向来源/目标/详情/预警回归和typecheck通过。

## Task 2：验收

**Files:** README.md、docs/reviews/2026-10-28-incoming-shields.md。

- [x] React/simplify自审；全量、build、显式启动、Prettier及diff检查通过。
- [x] 独立自然试玩捕获施盾准备，验证双向定位/图鉴/筛选/排序、键盘、390/320截图目视与日志；正式档只读。
- [x] 完成README、验收和计划，明确实测边界，恢复视口并清理试玩。
