# 合成预览实施计划

**Goal:** 玩家确认前看清合成目标、代价、基础属性和技能变化，成功后可撤销。
**Architecture:** Session复用只读验证器，展示模型复用图鉴与maxHeroHp，React面板由App接入既有事务与模态机制。
**Tech Stack:** 现有TypeScript、React19、Phaser、Vitest、Vite，无新依赖。
**Spec:** `docs/superpowers/specs/2026-10-23-merge-preview-design.md`

## 约束和审查

按用户持续授权顺序实现，无子代理。v24/schema2/规则数值/RNG/默认命令/原拖放不变。目标不得自动回退到另一只，已领取/扩地/最高阶不得可确认，合成必须保留目标位置及身份。明确单只属性和双只总生命区别、备战不参战；读取/取消无副作用，失败保留撤销。

## 任务

- [x] `src/game/session.ts`导出`sourceUnit(preparation, source): Unit|null`和`mergeError(preparation, source, targetId, maxRank): string|null`，transfer调用同一验证且保留旧错误语义；实际操作测试确认事务、拒绝、撤销不变。
- [x] 新建`src/ui/merge-preview.ts`和测试：读取候选和图鉴前后值、解锁列表、maxHeroHp总量、位置说明；八灵/阶数/招募/备战/失效输入与真实transfer对照，读取不改state/revision/RNG。
- [x] `MergePreview.tsx`与专属CSS，目标选择不自动替换，确认前后留位及腾出提示、可滚动布局；`PreparationPanel.tsx`添加选中来源入口，App接useModalFocus及成功/失败/就绪检查。执行针对性测试与typecheck。
- [x] 使用simplify复查修改区，完整测试/生产构建/显式startup-build检查；game-playtest使用独立开发/生产端口真实操作确认/取消/撤销/刷新/无候选、320和390布局，记录日志与截图。
- [x] README与验收文档，清理自己的标签/视口/服务，Git空白检查，交付新功能未提交的结果。
