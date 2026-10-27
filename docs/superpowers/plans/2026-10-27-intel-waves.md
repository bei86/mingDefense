# 敌情波次时间表实施计划

**Goal:** 在敌情手册查看各波时段的真实固定出场构成。

**Architecture:** 扩展现有stageIntel返回waves，复用已选队列；StageIntel内联渲染只读列表。不新增会话命令或引擎字段。

**Tech Stack:** React19、TypeScript、Vitest、Vite、CUA。

**Spec:** docs/superpowers/specs/2026-10-27-intel-waves-design.md

持续授权本会话顺序执行与自审，不派代理，本轮不提交新开发。

## 约束和审查重点

保持规则、随机、3格、content v24/schema2、全部存储格式、容量、fixture/素材/依赖/npm命令。波次时段取实际队列，不从配置数量重新生成；边界左闭右开；首领不重计；不把召唤算固定数量；空段不伪造时间；当前候选不影响其他关。UI仅只读，不持有派生状态，不改变暂停及原返回入口。

## Task 1：模型和界面

- [x] 在stage-intel.test.ts新增全50关队列分段守恒与边界测试、候选实际数量、空队列、只读输入；StageIntel.test.tsx增加可见语义与候选/其他关/空段断言。先运行观察失败。
- [x] stage-intel.ts新增EnemyWaveIntel类型（index/startAt/firstAt?/lastAt?/total/counts），StageIntelSummary增加waves。按阶段起点划分队列，一次归组，按实际种类统计；第一段包含起点前条目。独立数组派生，不改schedule。
- [x] StageIntel.tsx在总说明后渲染aria-label="波次时间表"的有序列表、时段编号、首末时间/空提示、种类数量及边界说明；stage-intel.css使用现有主题、竖向卡片、overflow-wrap。
- [x] 定向测试、React/simplify自审、全量测试、TypeScript/build、显式启动检查。

## Task 2：浏览器和文档

- [x] 正常UI检查进度预览首领、当前候选队列、整备/暂停返回与键盘焦点；390/320宽、短屏滚动、生产无开发入口，保存截图并恢复视口，关闭预览服务。
- [x] README与docs/reviews/2026-10-27-intel-waves.md记录实际结果及限制；Prettier/git diff检查，勾选计划，保持新开发未提交。
