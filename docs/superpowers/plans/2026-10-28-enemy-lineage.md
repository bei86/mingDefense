# 敌人衍生关系查看 Implementation Plan

> 按用户持续授权顺序实施、自审与验收，不另启代理；本轮新增开发留工作区。

**Goal:** 从敌人详情准确查看直属存活衍生个体及仍存活来源。

**Architecture:** enemyInspection携带ownerId；enemy-lineage纯函数从完整存活投影派生来源/子代；EnemyLineage复用原名单样式，EnemyInspection事件处理清筛选、选编号和聚焦。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-enemy-lineage-design.md

## Global Constraints

保持规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、保存/收藏/备份格式与容量、素材、依赖、默认命令。

## Review Focus

1. 多位同名来源不能混算，直属不包含孙代。
2. 来源已死亡或缺失只显示说明，分裂母体不提供无效跳转。
3. 当前类别不能挡住跨类关系定位，准确选编号并聚焦。
4. 切实例重收起，档案往返保留展开及暂停。
5. 320名单按钮不横溢、名称编号生命可读，投影只读。

## Task 1：关系模型与真实生成验证

**Files:** 新增src/ui/enemy-lineage.ts和.test.tsx，修改src/ui/enemy-inspection.ts。

- [x] 先写失败测试：多来源/同种、直属/孙代、死亡排除、来源缺失、旧字段、真实召唤与分裂、空输入和完整JSON只读。
- [x] 附带ownerId，实现纯关系模型并通过定向测试。

## Task 2：关系面板和导航

**Files:** 新增src/ui/EnemyLineage.tsx；修改src/ui/EnemyInspection.tsx、README.md；新增docs/reviews/2026-10-28-enemy-lineage.md。

- [x] 来源有效跳转与默认折叠名单，复用原样式，SSR覆盖默认/展开/失效来源。
- [x] 关系选择校验存活编号、清筛选、通知原onSelect并聚焦select，实例key重置展开；不改其他入口。
- [x] 自审/simplify、定向、全量、build和显式启动依赖、格式/diff检查。
- [x] Chrome自然召唤跨类往返、焦点/编号/暂停、档案保留、390/320截图与清理，正式档只读核对。
- [x] 更新README及验收记录，勾计划，新开发留工作区。
