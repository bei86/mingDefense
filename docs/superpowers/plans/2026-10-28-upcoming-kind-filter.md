# 后续敌袭种类筛选 Implementation Plan

> 用户持续授权本会话自主实施、自审与验收，不派代理，新开发留待下次提交。

**Goal:** 直接查看特定种类尚未出场的固定计划。

**Architecture:** upcomingEnemies先按spawnIndex提取带绝对索引的队列并统计完整counts，再按kind筛选、分页；UpcomingEnemies维护本次kind/page，List复用原控件展示。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-upcoming-kind-filter-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖与默认命令。

## Review Focus

1. 稀疏种类筛选后的条目仍保留原队列绝对index、同刻顺序、入口和计划时间。
2. 总数/counts不随筛选变化；matched/pageCount/hiddenCount及范围仅计当前种类。
3. 页码夹取基于匹配长度，改种类回第一页；种类耗尽/缺失归all，空队列不伪造页码。
4. ended/旧kind/场上衍生/未出场边界不变，读取不推进战斗或消耗RNG。
5. 档案返回保留条件和页码，普通切页重置，键盘和窄屏可读。

## Task 1：选择与分页投影

**Files:** src/ui/upcoming-enemies.ts、新upcoming-kind-filter.test.tsx；旧upcoming-enemies.test.ts仅补精确空投影字段。

**Interfaces:** UpcomingEnemyFilter=EnemyKind|'all'；upcomingEnemies(battle,requestedPage=0,kind='all')；view增加kind、matched，remaining/counts仍为完整队列。

- [x] 添加真实50关各类全页拼接、稀疏索引/同刻、页边界、旧kind/耗尽/结束态和只读测试，先失败后实现。
- [x] 消费游标后为条目保留绝对index，先完整统计再筛选分页；hiddenCount=matched-next.length。

## Task 2：控件与生命周期

**Files:** src/ui/UpcomingEnemies.tsx，upcoming-kind-filter.test.tsx。

- [x] List增加onKind可选回调及种类select；显示筛选匹配数与范围语义，摘要档案入口不变，空队列隐藏控件。
- [x] UpcomingEnemies维护kind，改种类同时setPage(0)，分页保留kind；不新增effect或持久化。
- [x] SSR验证全局摘要/匹配分页/结束空态；定向测试、TypeScript及React/simplify自审通过。

## Task 3：验收与文档

**Files:** README.md、docs/reviews/2026-10-28-upcoming-kind-filter.md。

- [x] 全量测试、生产构建、显式启动边界、格式与diff检查。
- [x] 独立合法试玩验证两页→单种、改种类回第一页、档案返回、切页、键盘、320/390截图和日志，清理临时视口/试玩。
- [x] 完成README/验收/计划，明确真机及生产包浏览器未测边界。
