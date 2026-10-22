# 第41–45关实施计划

**Goal:** 在v22前40关不变的基础上扩展45关与双段横扫首领。
**Architecture:** 单一JSON驱动纯模拟；Warning可选echo标记区分第二段，React/Phaser只展示；既有备份迁移支持v22。
**Tech Stack:** TypeScript、React19、Phaser3、Vite7、Vitest3，无新依赖。
**Spec:** ../specs/2026-10-22-forty-five-stages-design.md

用户已批准直接开发，本会话原生执行，不自动提交，不启动子代理。

## 全局约束与重点

- 完整前40配置保留；新增P；180秒、连续一秒出怪、三格接敌、45终点。
- 多格跨行每段最多一次；追击不因首段死亡而换行。
- 冻结两段推迟；父死撤销两段；双方同帧伤害仍依既有规则。
- 旧40完成可继续41，奖励幂等；迁移写入失败保留原档。
- 固定策略样本不代表玩家通关率；无强攻全程样本就明确报告。

## Task 1：规则与存档

- [x] 保存v22快照，追加41–45与ninthBoss、v23；content映射加入回锋妖将和双段说明。
- [x] combat-model增加Warning.echo?:boolean；combat生成第二条due=firstDue+900预警，resolve按echo乘60%，不换row。
- [x] 写forty-five-stages.test.ts，验证前缀toEqual(v22)、出怪时刻、两段伤害/冻结/父死/跨行/召唤/免疫、v22迁移失败和45终点回滚。
- [x] 更新历史测试范围与fixtures版本，前40结果和payload保持；npm typecheck及定向规则测试。

## Task 2：校准与检查点

- [x] 新增tools/compare-forty-five-stages.test.ts：COMPARE_FORTY_FIVE=1下，三组45关完整合法模拟，finally恢复配置；输出artifacts/forty-five-candidates.json。
- [x] 选择保有控制/经济路线的新增候选，记录强攻在前40的限制；写入最终新关参数。
- [x] 新增export-forty-five-stages.test.ts，UPDATE_FORTY_FIVE_FIXTURE=1导出41/45检查点与完整72路线；新增回归测试验证前40golden、所有检查点合法/战报守恒。

## Task 3：表现与交付

- [x] 更新45终点文案、帮助和敌情；新首领独立程序轮廓、双段预警、首领提示。新增41/45隔离DEV入口及禁写测试。
- [x] 添加两张新首领素材完整复制提示词；更新README运行/复现/迁移说明。
- [x] npm test -- --maxWorkers=2、npm run build、Prettier及diff检查；simplify自检本轮代码。
- [x] game-playtest浏览器验证320/390、41/45、暂停倍速/双段预警；保存截图、记录实际完成范围，不声称真机验收。
