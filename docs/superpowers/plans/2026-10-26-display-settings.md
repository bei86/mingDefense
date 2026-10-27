# 战斗画面设置实施计划

**Goal:** 为玩家提供独立的伤害飘字和减少角色动态设置。

**Architecture:** 纯偏好模块负责独立存储与有效显示策略，React通过系统媒体查询订阅和ref传递表现选项，复用已有渲染分支与飘字采样清空逻辑。按用户持续授权原生顺序实施、自审；不派代理，不重复审批，本轮新开发不提交。

**Tech Stack:** React19、Phaser3、TypeScript、Vitest、Vite、Chrome。

**Spec:** `docs/superpowers/specs/2026-10-26-display-settings-design.md`

## 全局约束与审查重点

- 不改contentv24/schema2、三格距离、战斗数值、素材、依赖、npm命令与黄金开局。
- `ming-defense:display:v1`独立版本1；隔离试玩完全绕过正式画面偏好读写。
- 无效/读失败回退默认不写入；写失败保留本页设置，提示未记住。
- 系统减少动态始终生效；更改设置不重建Phaser或修改战斗，关闭弹窗仍暂停。
- 飘字停用/重新启用不补旧数；技能与首领预警保留；窄屏44px、焦点循环与内部滚动。

## Task 1：偏好与策略

文件：`src/presentation/display-options.ts`、对应test。

- [x] 先写测试：`readDisplayOptions(isolated?, storage?)`返回`{numbers:true,motion:'system'}`默认；`saveDisplayOptions(options,isolated?,storage?)`返回保存成功布尔值；`displayEffects(options,systemReduced)`返回`{numbers,reducedMotion}`。
- [x] 覆盖合法偏好、坏JSON/版本/类型、不写回默认、读写抛错、隔离桩不调用，以及系统优先的组合。
- [x] 运行缺模块失败后实现最小模块并重跑。

## Task 2：表现层与菜单接线

文件：`src/ui/DisplaySettings.tsx`、css、SSR测试，`useSystemReducedMotion.ts`、App、CombatPanels、Battlefield、combat-feedback及测试。

- [x] 用useSyncExternalStore订阅`prefers-reduced-motion`，服务端默认false；App管理偏好、保存状态、弹窗和设置ref。
- [x] 整备底部与暂停菜单提供“画面设置”，接入既有useModalFocus；弹窗两个表单控件44px，说明系统优先、预警保留及隔离临时状态。
- [x] `CombatFeedback.update(session,delta,visible?,numbersEnabled?)`只控制numbers.update的visible参数；真实模拟对照测试声音一致、Session不变、清空且不补旧数。
- [x] Battlefield用ref读取有效选项，移除本地重复系统订阅；数字关闭传空列表，角色姿态沿用已有reducedMotion分支，effect依赖不加入选项。
- [x] 定向测试、类型检查，React最佳实践及simplify自审。

## Task 3：验证与记录

- [x] 用game-playtest技能浏览器检查两入口、更改后保持暂停、正常偏好刷新、隔离临时偏好、战斗截图及390/320布局，恢复视口和正式默认偏好。
- [x] 全量测试、生产构建、显式startup-build、Prettier及diff检查。
- [x] 更新README、`docs/reviews/2026-10-26-display-settings.md`与本计划的完成状态，准确说明未做真机性能/系统设置实测。
