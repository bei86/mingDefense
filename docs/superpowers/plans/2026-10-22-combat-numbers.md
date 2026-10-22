# 战斗飘字实施计划

**Goal:** 在角色顶部显示实际伤害与护盾吸收，保持规则及竖屏操作不变。
**Architecture:** CombatNumbers从相邻Session快照生成有界表现记录，挂在CombatFeedback上共用时钟；CombatNumberLayer以有界文字池绘制，Battlefield只负责接入。
**Tech Stack:** TypeScript、Phaser3、Vitest；无新依赖。
**Spec:** ../specs/2026-10-22-combat-numbers-design.md

## 全局约束

保留v24/schema2、规则、RNG、检查点、启动命令和既有声音；当前代理直接实施，新代码留待用户下次提交。

## 重点检查

战报累计值避免升级补血抵消承伤；消失敌人只补上次剩余生命；自然失盾不飘字；隐藏和读档不补播；文字池/列表必须有上限；死亡与结算不能让旧字永远停留。

## 步骤

- [x] 新建 `src/presentation/combat-numbers.ts` 和对应测试：`CombatNumbers.update(session,time,visible)`、只读active记录；只在combat采样。统计承伤/吸收和敌人生命差，记录位置、born、amount、team、kind、id；180毫秒合并、700毫秒清除、24条全局上限、同目标同类2条上限，隐藏/回滚/新战斗清空。覆盖实际伤害、缺战报回退、死敌清理、上限、重试与状态不变。
- [x] 在 `CombatFeedback` 创建numbers实例并于update同步采样，共用既有time；追加测试确认暂停/天赋冻结、倍速与回滚清空，不改变既有音效结果。
- [x] 新建 `src/render/CombatNumberLayer.ts` 及文字池测试：整数/万单位格式；角色顶部的网格位置转换，16px字/深色描边、金/珊瑚/紫三色、700毫秒轻微上浮淡出；减少动态效果时位置与透明度稳定；文字数量最多24、按采样密度设置分辨率，复用并隐藏空闲对象。
- [x] `Battlefield.tsx` 场景创建文字层，finishFrame统一绘制，使整备/结算立即清空；开发性能输出文字active/pooled。不改React HUD和输入。
- [x] 按game-playtest实测隔离关卡开战、真实数字、暂停/恢复、返回布阵与重试，保存390/320/桌面截图；按simplify复查新增代码，运行全量测试、build、启动依赖测试、Prettier与diff-check，更新README及验收文档。
