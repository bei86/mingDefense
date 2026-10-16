# Five-stage campaign implementation plan

**Goal:** 完成已获用户授权的 M2/M3：五关连续成长、六英雄六阶、升级天赋、Boss 和本地检查点恢复。

**Architecture:** 延续独立 50ms TypeScript 模拟器与 React/Phaser 分离。配置仍为唯一数值源；将成长、技能、存档拆成独立模块，Session 控制原子命令与阶段切换，UI 只发命令。

**Tech Stack:** 已安装的 TypeScript、Vite、React、Phaser 3、Vitest，不新增运行依赖。

**Spec:** `docs/superpowers/specs/2026-10-14-prototype-balance-design.md` 第 2–9 节。用户“好开始下一步”承接上一轮五关/天赋/Boss建议；沿用既定设计直接执行，不重复设置审批关卡。原生实现，本轮不提交或重排用户已暂存的文件。

## Global constraints

- 6×6、初始12格、备战2实例、刷新15、50ms、180秒、1×/2×确定性，保留M1回归模式。
- 六英雄只开放桃/鱼/鹰/猪/鼠/狐，猴/熊仍是后续内容；最高六阶。
- 失败与中止丢弃本关产果/经验/天赋，恢复完整开战检查点；同一关奖励一次。
- 胜负同帧先结算，存活为空先判负；未来波次/已生成召唤不清空不能胜利。
- 三个独立种子流：商店、天赋、战斗；存档使用 contentVersion，不兼容档备份后提示新局。
- 暂停/切后台/打开天赋清除聚灵按住状态；不保存渲染对象。

## Review focus

1. 一次击杀跨多个等级、天赋池不足或已满：依次选择，空池换5灵钱，不能死锁。
2. 最后一击升级与失败/胜利并发：失败不弹天赋，胜利待选完成后进入下一关，不重复收益。
3. Boss前摇死亡、低血阶段和召唤上限：取消未释放攻击，已生成召唤仍需清理。
4. 战斗中刷新、损坏/旧版本存档、存储不可写：安全回到检查点，旧档保留且不静默套新值。
5. 六阶/护盾/生命天赋/重伤与恢复：合成不改形状，护盾到期，生命提升不复活。

## Tasks and interfaces

### 1. 内容与成长

Files: `content.ts`, new `progression.ts`, `model.ts`, `random.ts`, `campaign.test.ts`.

- [x] 冻结v1配置快照，更新contentVersion为v2；导出六英雄、关卡、敌人、阶段显示配置。
- [x] 定义 `Progression {level,xp,buffs,rng}`、`BuffId`；`gainExperience(progress,xp):number` 返回待选次数；`drawBuffs(progress,units,stageId):BuffId[]` 过滤并按品质无放回抽取。
- [x] 定义 `bonus(progress,id)` 与天赋描述，应用上限/前置/英雄阶级条件。
- [x] 用Vitest检查超额经验、独立RNG、三选不重复、无效池、六阶数值及入参不变性。

### 2. 战斗与技能

Files: `combat.ts`, new `combat-model.ts`, `combat-skills.ts`, `campaign.test.ts`.

- [x] `createCombat(units, options?)` 接收关卡/成长/战斗RNG，旧默认选项仍可跑M1裸战斗。
- [x] 混合波次按类型ID交错，按关卡系数取整敌人生命/伤害；Boss使用绝对表值。
- [x] 实现桃产果、鱼减速/冰冻、狐护盾/光环/初始能量、猪五阶触发频率、鹰五阶已释放双段/剑阵及天赋公式。
- [x] 实现Boss横扫预警、二阶段/召唤上限；胜负优先级、经验待选暂停、天赋立即重算存活英雄属性。
- [x] 定向测试命中/护盾/冻结/释放事件、Boss、关间确定性，M1测试保留。

### 3. 会话与存档

Files: `session.ts`, new `persistence.ts`, `persistence.test.ts`, `campaign.test.ts`.

- [x] Preparation新增stageId/progression/combatRng/rewardedStages；`chooseBuff(id)`、`nextStage()`、`exportSave()`、`Session.restore(data)`。
- [x] 正常通关结算产果和奖励，胜利待选完成才允许下一关，重试不刷新随机数；满棋盘不再抽扩地。
- [x] localStorage适配器按版本验证整备/关后/完成状态；COMBAT只存开战检查点，异常档备份提示；存储失败不影响当前游戏。
- [x] 以实际完整战斗测试跨关、恢复生命、战斗刷新回滚、重复奖励及旧档/损坏档处理。

### 4. UI与战场

Files: `App.tsx`, `Battlefield.tsx`, `style.css`, new `CampaignPanels.tsx`, `useSessionStorage.ts`.

- [x] 沿用森林青绿/暖金风格；动态关卡/波次/敌人数，增加经验条、天赋弹窗、战后下一关、完成页和存档提示。
- [x] 原创桃/鱼/狐形状、护盾、冻结、Boss血条与横扫预警，不用面板遮住活动战场。
- [x] 结算分解收益；六阶说明；重新开始需确认；隐藏/失焦与天赋选择暂停正确衔接。

### 5. 验收

- [x] `npm.cmd test`、`npm.cmd run build`，检查当前实际diff，不动用户已暂存区。
- [x] 浏览器冷启动/领取/升级/跨关/重试/刷新恢复/三选一/Boss，截图验证390px/320px和桌面。
- [x] 至少三种真实阵容跑五关模拟并记录结果，区分压力测试与正常经济可得阵容，不宣称所有流派平衡。
- [x] README及验收报告记录范围、临时参数、已验证行为与仍待真机校准项。


验收完成：53项测试及生产构建通过；三条合法经济路线通关；浏览器验收与限制详见 ../../reviews/2026-10-15-five-stage-playtest.md。

2026-10-15 用户修正：进入下一关免费刷新三张招募，覆盖旧未领取卡，保留阵容和成长；失败/中止/整备重载不刷新。Session共用抽取函数，手动刷新继续收费15；回归测试54项通过。
