# 冻结首领预警时间 Implementation Plan

> 用户持续授权当前会话实施、自审、验收；不派代理，新开发留工作区。

**Goal:** 暂停敌人详情准确区分冻结时间与横扫准备时间。

**Architecture:** InspectedWarning新增frozenMs投影，EnemyWarnings按冻结状态展示两段时间；保留HUD及跳转接口，复用当前样式。

**Tech Stack:** React19、TypeScript、Vitest、浏览器/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-frozen-warnings-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式容量、素材、依赖及默认命令。

## Review Focus

1. 冻结期间横扫/回响准备时间不下降，冻结剩余下降，解冻后恢复并释放。
2. 0准备冻结显示待解冻；1ms向上到0.1秒，冻结到期恢复原显示。
3. 同名不同首领不混淆，失效来源不出现，普通来源不借用首领冻结逻辑。
4. 读取/渲染不改变Combat/RNG及行内名单，原快捷定位可用。
5. 390/320长时间文案换行、键盘与名单焦点可用。

## Task 1：投影与文案

**Files:** 修改src/ui/enemy-inspection.ts、EnemyWarnings.tsx、enemy-inspection.test.ts、warning-allies.test.ts；新增frozen-warnings.test.tsx。

**Interface:** `InspectedWarning.frozenMs:number`；仅kind=boss读取`Math.max(0,(enemy.frozenUntil??0)-battle.time)`。

- [x] 写真实生成/冻结/解冻/释放、零值/边界、来源隔离和SSR只读测试并先运行确认失败。
- [x] 新增frozenMs字段并更新原精确模型预期；原冻结测试分别核对准备保持与冻结剩余下降。
- [x] EnemyWarnings冻结时间大于0时输出冻结说明、解冻后准备或待解冻；其他情况保留剩余/待释放。复用inspection-warning-note，无新状态或计时器。
- [x] 定向预警/详情/跳转测试与typecheck通过。

## Task 2：验收

**Files:** README.md、docs/reviews/2026-10-28-frozen-warnings.md。

- [x] React/simplify自审，全量、build、显式启动、格式和diff检查。
- [x] 自然隔离试玩预警、键盘/跳转、390/320截图目视；如捕获冻结则核对双时钟，明确实测边界，正式档只读。
- [x] 完成文档与计划，恢复视口、清理试玩，新开发留待下次提交。
