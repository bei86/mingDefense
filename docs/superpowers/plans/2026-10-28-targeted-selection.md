# 锁定压力筛选 Implementation Plan

> 用户持续授权本会话自主实施、自审和验收，不派代理，新开发留待下次提交。

**Goal:** 快速浏览被锁定或未被锁定的存活灵兽。

**Architecture:** selectAllies复用targetedBy增加targeted/untargeted筛选和种类内计数；AllySelection补选项、缓存语义说明与锁定排序指标前置，不新增战斗状态。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-targeted-selection-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖与默认命令。

## Review Focus

1. 只计存活敌人缓存，冻结/接近仍计；不按准备攻击和横扫重判。
2. 倒下、备战与无效编号不混入，两组数量按种类守恒。
3. 编号0、多实例、筛选失配与空交集保持现有契约。
4. 缓存转移/移除后重新读取更新分组，不缓存旧名单、不改引擎。
5. 图鉴返回、快捷定位、普通切页、窄屏与键盘生命周期无回归。

## Task 1：选择模型与控件

**Files:** src/ui/ally-selection.ts、AllySelection.tsx；新建targeted-selection.test.tsx，旧ally-selection/shield-selection测试仅扩展精确counts期望。

**Interfaces:** AllyStatusFilter增加targeted/untargeted，counts仍为Record；selectAllies签名及排序算法不变。

- [x] 真实Combat与SSR测试覆盖Review Focus 1–4，先运行确认新增行为失败。
- [x] matchesStatus添加两种状态，counts按matchingKind中的存活投影计数；UI添加选项与语义说明，targeted排序前置现有allySortLabel，保留其他排序格式。
- [x] 定向测试与TypeScript通过；React/simplify自审，无新effect、持久化或重复派生状态。

## Task 2：验收与文档

**Files:** README.md、docs/reviews/2026-10-28-targeted-selection.md。

- [x] 全量测试、build、显式启动边界、Prettier及diff检查。
- [x] 独立试玩自然锁定，验证Review Focus 5，保存并目视320/390截图，检查日志；恢复视口关闭试玩。
- [x] 完成README与验收记录，明确实际验证边界，新开发留工作区。
