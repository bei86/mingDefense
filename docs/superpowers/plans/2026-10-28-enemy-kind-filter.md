# 暂停敌人种类筛选 Implementation Plan

> 按用户持续授权原生顺序实施与自审，不另启代理；本轮新增开发留工作区。

**Goal:** 暂停时先按存活敌人种类与数量筛选，再查看具体实例。

**Architecture:** selectEnemies(view, kind, selectedId)纯投影生成种类计数、有效筛选及选择；EnemyInspection只存本地kind，切换时同步父层onSelect。复用已有select样式。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-kind-filter-design.md

## Global Constraints

保留战斗规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份格式与容量、素材、依赖和默认命令。面板本地状态不写存档。

## Review Focus

1. 普通狼与召唤狼、分裂母体与碎片不能混为一种，死亡实例不计。
2. 当前实例在新结果中保留，不匹配时切首个；失效类别和编号能回退。
3. 预警首领精确编号、锁定列表跨页跳转不被旧筛选阻挡。
4. 无活敌保持空态，过滤不改变父层战斗、排序、时钟或RNG。
5. 320窄屏原生select可读，无横向溢出，控件至少44px。

## Task 1：筛选投影及边界

**Files:** 新增src/ui/enemy-selection.ts、src/ui/enemy-selection.test.ts。

**Interfaces:** `selectEnemies(view: EnemyInspectionView|null, kind: EnemyKind|'all', selectedId: number|undefined)`返回`{kinds:{kind:EnemyKind,name:string,count:number}[],kind:EnemyKind|'all',enemies:InspectedEnemy[],selectedId:number|undefined,total:number}`。

- [x] 编写测试，确认缺少模块失败；覆盖五类review边界中模型部分，使用真实enemyInspection输入。
- [x] 一次遍历按原顺序Map聚合种类，失效kind退回all；filter生成结果，保留匹配selectedId否则首个，null/空输入返回空。
- [x] 定向通过，完整JSON确认不修改Session或投影。

## Task 2：详情接入及验证

**Files:** 修改src/ui/EnemyInspection.tsx；新增src/ui/enemy-selection-ui.test.tsx；更新README.md、docs/reviews/2026-10-28-enemy-kind-filter.md。

- [x] 本地useState存kind，渲染“敌人种类”全部及计数选项，派生结果驱动原“查看敌人”下拉与详情。
- [x] 切类别时以当前实际选中实例计算下一选择，setKind并onSelect，显示当前/总数说明；保持原跨页与预警回调。
- [x] SSR覆盖默认全部、首领名/数量、具体编号及预警保持、空态；回归原预警、锁定跳转测试，React/simplify自审。
- [x] 全量测试、build、显式启动依赖、格式和diff检查。
- [x] 正常UI第50关暂停，390/320筛选及具体实例切换、返回全部、切页重置和目标跳转；截图目视检查，正式页不推进。
- [x] 更新README与验收文档，勾选计划，留工作区。
