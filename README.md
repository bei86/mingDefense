# 灵林守阵 / mingDefense

《小妖卫道》玩法研究基础上的竖屏 H5 原型。当前包含四十关内容：八种灵兽、1–6 阶、经验天赋、八位首领、远程/召唤/分裂敌人和本地检查点恢复。3格接敌规则已实现，已有控制/不聚灵和经济/聚灵的合法路线完成四十关，整体难度仍待玩家与原活动实机校准。已有来源的规则继续保留，缺失数值按用户授权设计；这不是原作数值还原完成版。

## 启动

需要 Node.js 20.19+ 或 22.12+（本机验证 Node 24.12）。

```powershell
npm.cmd install
npm.cmd run dev
```

打开 http://127.0.0.1:5173/ 。默认仅监听本机。

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`test` 包含当前3格规则的72条固定经济策略诊断、规则及迁移测试，以及明确标记“历史1格规则”的十至四十关经济路线回归。旧路线的通关数不代表新版3格结果。`build` 包含 TypeScript 检查与生产构建。

## 现有图片素材预览

已接入现有生成图中的 41 张：八灵、5 类普通敌人、5 位首领、森林场景、资源/天赋图标、面板/按钮和 5 种特效。开发服务器打开 http://127.0.0.1:5173/?playtest=roster 可直接查看八灵占格效果；该入口不读取或写入正式存档。打开默认地址可正常开始或继续游戏。

原图保留在 `docs/img`，运行资源为 `public/assets/art` 的 WebP，总计约 2.68 MB。缺图敌人和第 15 关首领沿用程序绘制；第 30 关暂用羽弓变体；已有图片首领的二阶段暂用同一造型加暖色提示。角色目前为静态图，攻击仍使用程序连线和已有特效。

重新处理本地原图（仅开发工具需要 uv/Pillow，游戏运行不需要 Python）：

```powershell
uv run --with pillow python tools/prepare-game-assets.py
```

工具输出类型清单 `src/render/art-manifest.json` 和原图哈希报告 `artifacts/art-preparation.json`。本轮接入范围、排除图片和实际试玩限制见 [现有素材验收记录](docs/reviews/2026-10-20-existing-art.md)。

## 第一局与四十关流程

第1关整备时显示可收起的「首战指引」，按当前阵容提示招募、部署、同种同阶合成和开战。提示按钮只选中灵兽，仍需自己点击棋盘或拖动；备战席、撤销和刷新后会重新判断。进入战斗及第2关后隐藏。可用 [独立首战试玩](http://127.0.0.1:5173/?playtest=onboarding) 体验，该开发入口不读取或写入正式存档，刷新重开，不进入生产包。详见 [首战指引验收](docs/reviews/2026-10-21-first-battle-guide.md)。

整备界面提供完整格子、占位、招募与备战席；开始守阵后切换为紧凑战斗界面，收起布阵底格，顶部显示阵容生命、剩余时间、波次与出怪进度，底部为聚灵与倍速。点击右上角暂停，可查看敌情、天赋、玩法说明或确认返回布阵。返回调整或进入下一关时恢复整备布局。界面验收见 [整备与守卫界面](docs/reviews/2026-10-21-preparation-combat-ui.md)。

1. 领取一只烬灵鼠，部署在第 2 列第 4 行；另一只鼠叠放上去合成 2 阶。
2. 岩甲豚放第 3 列第 4 行，横占两格；青锋隼放第 4 列第 5 行，占 2×2 格。
3. 开始守阵。灵兽自动攻击，击杀积累经验；升级会暂停并提供最多三项天赋，选择后继续。
   开场后每秒一只连续出怪，波次之间不留空档，也不等待上一波清完；本关配置出完后停止生成。
4. 按住聚灵石消耗灵气提升攻速。暂停、切出页面、失焦和升级选择都会清除按住状态；继续时重新按住。支持 1×/2× 速度。
5. 胜利后结算通关、产钱及天赋收入，进入下一关整备时免费刷新三张招募，覆盖上一关未领取的招募。阵容、格子及修行保留，下次开战全员满血。失败重试或返回布阵不会刷新招募。
6. 第 5 关首领会横扫预警，低血进入二阶段并召唤小怪；所有波次、首领、已生成小怪及已释放伤害事件结束后才胜利。
7. 第6关起英雄招募有15%概率为二阶；狼每存活10秒增加5%攻击，最多六层。新增翎羽客远程攻击、鸣咒犬周期召唤、裂岩犀死亡分裂。鸣咒犬出生10秒后首次召2只咒影，之后每20秒召2只，每只鸣咒犬最多保有6只；冻结推迟时钟，父怪死亡停止未来召唤。远程也先清前排；召唤物无经验/灵气，碎片各2经验/灵气、不再分裂。
8. 第10关鸣咒统领开场起周期召唤、半血后加速，并预警横扫。第6关起还可解锁鼠的“终烬”：有前置天赋后，普攻有10%概率斩杀低于30%生命的非首领。
9. 第11–14关为远程、快攻、护甲、召唤和分裂组合。第15关岩铠领主有15%护甲减伤、每14秒横扫（1.8秒预警）、每18秒召2只咒影（上限6只），半血后攻速提高20%。护甲与易伤乘算、向下取整，最少1伤害。
10. 第16–19关继续组合既有敌人，第20关霜咒祭司每16秒召2只咒影，半血后每次4只（上限8只）、攻速+25%，横扫每12秒、预警2秒。半血不立即多召一波，也不重置计时；清空所有敌人和已释放伤害后才结算。
11. 第21–24关增加既有敌人的混合压力；第25关岩咒督军有15%减伤，每12秒横扫（2秒预警），每18秒召2只咒影、半血后每次4只（上限8只），半血攻速+30%。清场后可继续第26关。
12. 第26–29关组合狼、护甲、快攻、远程、召唤与分裂；第30关玄羽妖帅射程2.4格，仍先清前排。每12秒横扫（2秒预警），开场起每20秒召2只咒影，半血后每次4只（上限8只）、攻速+30%，无护甲、免疫斩杀。清场后可继续第31关。
13. 第31–34关组合快攻、护甲、远程、召唤与分裂；第35关赤角战魁为近战，15%减伤，每10秒横扫（2秒预警），每16秒召2只咒影，半血后每次4只（上限8只）、攻速+35%。清场后可继续第36关。
14. 第36–39关继续组合狼、快攻、护甲、远程、召唤与分裂；第40关玄甲咒尊为远程护甲首领，射程2.2格、15%减伤，每12秒横扫（2秒预警），每14秒召2只咒影，半血后每次4只、上限10只、攻速+35%。清场后完成四十关。

可点选后放置，也可拖动。同种同阶叠放合成，最高六阶；形状不随升阶改变。备战席最多两只且不参战。刷新花费 15 灵钱，获得三张招募；未领取内容需确认放弃。扩地令只解锁边相邻的一个格子。非法操作不会消耗招募、随机数或灵钱。准备期可撤销上一次布阵；刷新和遣散不能撤销。

新增灵兽：灵金桃存活时定期产钱，霜尾鲤减速并在三阶后周期冰冻，月音狐提供护盾、三阶攻击光环及五阶初始灵气。岩甲豚和青锋隼接入五阶技能。

穿林猿横占三格，沿瞄准方向贯穿，三阶施加 10% 易伤持续三秒，五阶追加第二段；已释放的第二段保持原方向，施法者或原目标死亡后继续结算。磐拳熊竖占两格，每次三道拳罡，各自只击中第一个敌人，近处同目标可中三弹；三阶命中后分裂两道 35% 伤害拳罡，不再递归分裂。新增三阶猴专属天赋“破势”，每层易伤增加 5 个百分点；熊“拳意”每层攻击 +10%，均最多三层。具体角度、碰撞、易伤时序及新增天赋为 P，等待实机校准。

敌人先清空最前方有存活灵兽的一整排，再攻击下一排；多格灵兽按最上方占格归排。同排先攻击低阶，同阶按类型仇恨优先：桃 8 > 狐 7 > 鼠 6 > 豚 5 > 熊 4 > 猴 3 > 鲤 2 > 隼 1；仍相同则按距离、实例 ID。保留用户给定六灵类型顺序，熊猴沿用豚鲤之间的预留位；等级暂按低阶优先，数字仅表示原型相对优先级 P。未查到完整原作仇恨数值表，见 `docs/research/2026-10-16-enemy-threat-and-rank.md`。选中灵兽可查看。

胜负结算可展开“逐兽战报”，查看每只上阵灵兽的实际伤害、生命承伤、桃产钱、施盾/吸收量与重伤情况；同种灵兽按位置区分。伤害不计过量部分，护盾吸收单列，失败的产钱仅供复盘、不计入保留收益。聚灵记录实际生效时间。整备时多格灵兽以整块不透明底色遮住占格，避免误认为空格；战斗时收起底板，突出角色与技能效果。

失败结算还可展开「失守复盘」，区分全员重伤和时间耗尽，给出最多三条建议。返回调整阵容后，复盘可收起，免费招募、备战上阵和同种同阶合成建议随当前布阵更新；重新开战后清除。复盘只保留在本次页面会话，刷新仍回到原开战检查点。详见 [失守建议验收](docs/reviews/2026-10-22-defeat-advice.md)。

## 存档与重试

本地自动保存整备、关后待选天赋和完成状态。战斗中刷新、失败重试或中止会回到完整的开战检查点，本关产钱、经验和天赋全部回滚。通关奖励每关只结算一次。“重新开始”清空本轮进度。

存档键为 `ming-defense:campaign`，按 `schemaVersion` 和 `contentVersion` 验证。旧版本或损坏数据先备份再开始新局；备份失败保留原档并停止覆盖。存储不可用时仍可玩，但刷新可能丢失新进度。数据仅在当前浏览器本地保存，未实现账号和云同步。

当前内容版本为 `prototype-2026-10-21-v22`。已知 v2/v3/v4/v5/v6/v7/v8/v9/v10/v11/v12/v13/v14/v15/v16/v17/v18/v19/v20/v21 可在备份后自动迁移，保留阵容、灵钱、成长和关卡，后续新战采用当前战斗规则；旧胜利战报保留原结果，缺少逐兽数据时提供说明。旧第五/十/十五/二十/二十五/三十/三十五关完成档可继续第六/十一/十六/二十一/二十六/三十一/三十六关，既有奖励不重复。迁移备份/写入失败时原主档保留，本轮停止自动覆盖。其他未知版本仍按上述不兼容流程处理。

## 结构与校准

- `src/game/content.ts` 直接读取 `docs/superpowers/specs/2026-10-14-prototype-balance.json`，数值以该 JSON 为准，v1 快照单独保留。改数值时同步更新内容版本及对应规则说明。
- `session.ts` 管理招募、布局、合成、阶段和收益事务；商店、天赋、战斗使用独立可序列化随机状态。
- `combat.ts` / `combat-skills.ts` / `combat-projectiles.ts` / `enemy-abilities.ts` / `combat-model.ts` 是独立 50ms 模拟器，不依赖 React/Phaser；批量伤害支持同帧互杀先判负，死亡取消未释放攻击，已释放剑阵与鹰/猴双段继续生效。新易伤在本步伤害结束后施加，已有易伤乘算普通伤害；不叠加，多猴取较高值并刷新持续时间。斩杀直接移除剩余生命，不受减伤/易伤影响，只统计实际生命损失。
- `combat-diagnostics.ts` 提供可选生命周期观测，记录出生/死亡边界，包含同一步被消灭的召唤物；不进入存档，不参与随机数和战斗决策。
- `progression.ts` 处理经验、天赋条件、品质权重和上限；`persistence.ts` 验证存档并处理恢复。
- `clock.ts` 处理速度与暂停，不追补离屏时间；`ui/game-loop.ts` 用独立25ms计时器推进50ms固定模拟步长，HUD最多10次/秒，模拟不依赖视觉帧回调。`render/Battlefield.tsx` 用 Phaser 绘制现有美术与缺图占位，`ui` 提供 DOM 操作及 HUD。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=boss ：载入正常经济模拟生成的第五关检查点，页面明确标记且禁止写存档。用于快速验收 Boss，不代表从首关手动通关；生产构建不包含该入口。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=roster ：固定八灵阵容，供占格/技能/拖动验收，页面标记并禁止写存档；不能用于证明正常经济平衡，生产构建不包含该入口。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=stage6 、 http://127.0.0.1:5173/?playtest=stage8 和 http://127.0.0.1:5173/?playtest=stage10 ：正常经济模拟生成的第六/八/十关检查点。第八关采用未聚灵且能实际召唤的通关路线，便于验收；禁止写正常存档，检查点失效时进入禁写临时局。生产构建不包含试玩入口、检查点和模拟器测试辅助代码。

当前接敌距离为 **3格（P）**：波次出生中心y=-2.5，最前排占格中心y=0.5。6×6布阵面积保留，前方区域不可部署；近战及现有首领先走入各自普攻射程，再经过现有200ms前摇出手；4格射程的普通远程可直接进入前摇。召唤/分裂仍在父怪附近，首领技能继续独立计时。守卫角色较五格版本放大20%，画布按容器宽度及屏幕像素密度提高采样分辨率；整备占位与点击格保持原样。

v22最新验证见 [第37–40关校准验收](docs/reviews/2026-10-21-stage40-calibration.md)：37关攻击系数8.1→7.3，39关生命系数27→20.5，40关首领生命1900000→1020000、两波远程各4→1、第二波起点8000→5000ms；保留每秒连续出怪及首领远程/护甲/技能机制，全部为P。完整72条固定策略前36关结果保持；控制/不聚灵和经济/聚灵各1条完成四十关，固定样本不是玩家胜率。

开发试玩 [当前三格第40关](http://127.0.0.1:5173/?playtest=calibration40) 来自v22正常购买路线（seed20261022，control，不聚灵），不读写正式存档，生产包排除。模拟98.05秒、余血4919，收入313；最终完成后灵钱326，不生成第41关或刷新招募。重建时额外设置`$env:UPDATE_STAGE40_CALIBRATION_FIXTURE='1'`再执行下方导出命令，完成后移除变量。旧`stage40`保留历史1格来源。

v21历史验证见 [第33–35关校准验收](docs/reviews/2026-10-21-stage35-calibration.md)：33关生命系数44→39.6，35关首领生命1600000→1480000、两波远程各4→1，第二波起点8000→5000ms，连续出怪，全部为P。72条固定策略前32关完整结果保持；控制/不聚灵和经济/聚灵各1条通过35/36关，控制停在37、经济到达40后失败，尚无40关完成路线。固定样本不是玩家胜率。

开发试玩 [当前三格第35关](http://127.0.0.1:5173/?playtest=calibration35) 来自v21正常购买路线（seed20261022，control，不聚灵），不读写正式存档，生产包排除。实战106.95秒、余血8334，无升级选择；进入36关恢复17332生命、灵钱296并刷新三张免费招募。重建时额外设置`$env:UPDATE_STAGE35_CALIBRATION_FIXTURE='1'`再执行下方导出命令，完成后移除变量。旧`stage35`保留历史1格来源。

v20历史验证见 [第28–30关校准验收](docs/reviews/2026-10-21-stage30-calibration.md)：28关生命系数42→37.8，29关攻击系数6.825→6.5，30关首领生命1400000→1050000、两波远程各4→1，第二波起点8000→5000ms，保持每秒连续出怪，全部为P。72条固定策略的前27关结果保持；控制/不聚灵和经济/聚灵各1条通过30关，两条过32、1条过34，33/35关仍有断点，尚无40关完成路线。固定样本不是玩家胜率。

v19记录见 [第25关校准验收](docs/reviews/2026-10-21-stage25-calibration.md)：25关首领生命1100000→800000，两波远程护卫各4→2、第二波起点6000ms。仍有4条到达、2条通过（控制1/经济1），本轮保留25关配置与检查点来源。

v18的前20关校准记录见 [三格关卡平衡验收](docs/reviews/2026-10-21-three-cell-balance.md)：普通远程伤害18→12，第15/20关首领生命650000→357500、950000→522500；仍有8条通过20关（强攻1/控制5/经济2）。历史三格/清晰度记录见 [渲染验收](docs/reviews/2026-10-21-three-cell-rendering.md)。

开发试玩 [当前三格第30关](http://127.0.0.1:5173/?playtest=calibration30) 来自v20正常购买路线（seed20261022，control，不聚灵），不读写正式存档，生产包排除。实战01:41、余血5599，选疾风后进入31关恢复17251生命、灵钱266且刷新招募。重建时额外设置`$env:UPDATE_STAGE30_CALIBRATION_FIXTURE='1'`再执行下方导出命令，完成后移除变量。旧`stage30`保留历史1格来源。

开发试玩 [当前三格第25关](http://127.0.0.1:5173/?playtest=calibration25) 来自v19正常购买路线（seed20261022，control，不聚灵），不读写正式存档，生产包排除。重建时额外设置`$env:UPDATE_STAGE25_CALIBRATION_FIXTURE='1'`再执行下方导出命令，完成后移除变量。旧`stage25`保留历史1格路线来源。

开发试玩 [当前三格第20关](http://127.0.0.1:5173/?playtest=calibration20) 来自v18正常购买路线（seed20261014，control，不聚灵），与历史stage20入口分开，禁止读取/写入正式存档，生产包排除。重建此检查点时，在下面导出命令前额外设置`$env:UPDATE_THREE_CELL_FIXTURE='1'`，执行后移除该变量。

开发入口 [满阵接敌验收](http://127.0.0.1:5173/?playtest=approach) 是固定36只六阶鼠与第40关首领的独立场景，不代表正常经济路线，禁止读写正式存档且不进入生产包。旧stage系列开发检查点保留历史1格路线的真实阵容/成长，仅迁移内容版本；进入后按当前3格规则战斗，页面明确标注来源。下面各阶段历史检查点导出命令仍使用1格规则，样本标明 ruleset 与 spawnRow。

导出当前3格的72条路线原始样本：

```powershell
$env:EXPORT_APPROACH_SAMPLES='1'
npx.cmd vitest run tools/export-approach-distance.test.ts
Remove-Item Env:EXPORT_APPROACH_SAMPLES
```

输出 `artifacts/approach-distance-samples.json`。本机若同时进行构建或大批模拟，可用 `npm test -- --maxWorkers=2` 控制CPU竞争。

实战调度修正见 [战斗运行验收](docs/reviews/2026-10-21-combat-runtime.md)：模拟与画面刷新独立调度，保持暂停、天赋选择、失焦及长卡顿保护。Chrome固定八灵验收阵容已实际完成首关并进入第二关；这不是正常经济通关证明，手机性能仍需真机补验。

历史v15验收见 [四十关验收](docs/reviews/2026-10-21-forty-stages.md)。v15追加36–40关和远程护甲首领玄甲咒尊，前35关/八灵完整保持v14，新增数值为P。72条合法路线中5条到达36关、4条完成40关（强攻2/控制1/经济1），不代表真实玩家通关率。

开发试玩入口：[第36关](http://127.0.0.1:5173/?playtest=stage36)、[第40关首领](http://127.0.0.1:5173/?playtest=stage40)，来自完整合法经济路线，禁读写正式存档，生产包不含入口。新首领暂用程序轮廓，扩展素材提示词见 `docs/art/2026-10-21-stage40-asset-prompts.md`。

```powershell
$env:UPDATE_FORTY_FIXTURE='1'
npx.cmd vitest run tools/export-forty-stages.test.ts
Remove-Item Env:UPDATE_FORTY_FIXTURE
```

输出 `artifacts/forty-stages-samples.json`。比较三组新增关卡候选（只改36–40和第八首领，finally恢复）：

```powershell
$env:COMPARE_FORTY='1'
npx.cmd vitest run tools/compare-forty-stages.test.ts
Remove-Item Env:COMPARE_FORTY
```

输出 `artifacts/forty-candidates.json` 和每组完整样本；采用standard，`FORTY_CANDIDATE` 可指定单个或逗号分隔候选。

历史v14验收见 [三十五关验收](docs/reviews/2026-10-21-thirty-five-stages.md)。v14追加31–35关和近战护甲首领赤角战魁，前30关/八灵完整保持v13。新增参数均为P。72条合法路线中5条到达31关且完成35关（强攻3/控制1/经济1），不代表玩家通关率。新首领暂用程序轮廓，缺图清单另列两项扩展需求。

开发试玩入口：[第31关](http://127.0.0.1:5173/?playtest=stage31)、[第35关首领](http://127.0.0.1:5173/?playtest=stage35)，均来自完整合法经济路线，禁读写正式存档，生产包不含入口。重生检查点与样本：

```powershell
$env:UPDATE_THIRTY_FIVE_FIXTURE='1'
npx.cmd vitest run tools/export-thirty-five-stages.test.ts
Remove-Item Env:UPDATE_THIRTY_FIVE_FIXTURE
```

输出 `artifacts/thirty-five-stages-samples.json`。比较三组新关候选（仅修改31–35及第七首领，finally恢复）：

```powershell
$env:COMPARE_THIRTY_FIVE='1'
npx.cmd vitest run tools/compare-thirty-five-stages.test.ts
Remove-Item Env:COMPARE_THIRTY_FIVE
```

输出 `artifacts/thirty-five-candidates.json` 及每组完整路线；采用standard。可用 `THIRTY_FIVE_CANDIDATE` 指定单组或逗号分隔候选。

历史v13验收见 `docs/reviews/2026-10-18-thirty-stages.md`。v13追加26–30关和玄羽妖帅，前25关/八灵完整保持v12。第六Boss生命/普攻/横扫1400000/135/230（P），射程2.4格。72条合法路线中11条进入第26关、9条到达30关、5条完成30关（强攻3/控制1/经济1）；脚本结果不代表真实玩家通关率。

开发服务器支持 http://127.0.0.1:5173/?playtest=stage26 与 http://127.0.0.1:5173/?playtest=stage30 ，来自完整合法经济路线，禁止读取/写入正式档，生产包不包含入口。重生26/30检查点及完整样本：

```powershell
$env:UPDATE_THIRTY_FIXTURE='1'
npx.cmd vitest run tools/export-thirty-stages.test.ts
Remove-Item Env:UPDATE_THIRTY_FIXTURE
```

输出 `artifacts/thirty-stages-samples.json`。比较五组26–30候选（只修改新增参数，进程结束前恢复）：

```powershell
$env:COMPARE_THIRTY='1'
npx.cmd vitest run tools/compare-thirty-stages.test.ts
Remove-Item Env:COMPARE_THIRTY
```

输出 `artifacts/thirty-candidates.json` 及每组完整样本；采用steady。可以设置 `THIRTY_CANDIDATE` 为单个候选或逗号分隔列表，仅运行指定组。

历史v12验收见 `docs/reviews/2026-10-18-twenty-five-stages.md`。v12追加21–25关和岩咒督军，前20关/八灵保持v11。第五Boss生命/普攻/横扫1100000/175/230（P），同时具有护甲和二阶段召唤强化。72条合法路线中22条进入第21关，11条完成25关（强攻4/控制4/经济3）。

开发服务器支持 http://127.0.0.1:5173/?playtest=stage21 与 http://127.0.0.1:5173/?playtest=stage25 ，均来自完整合法经济路线，禁止读取/写入正式档，生产包不包含入口。重生21/25检查点及完整样本：

```powershell
$env:UPDATE_TWENTY_FIVE_FIXTURE='1'
npx.cmd vitest run tools/export-twenty-five-stages.test.ts
Remove-Item Env:UPDATE_TWENTY_FIVE_FIXTURE
```

输出 `artifacts/twenty-five-stages-samples.json`。比较五组21–25候选（只修改新增参数，进程结束前恢复）：

```powershell
$env:COMPARE_TWENTY_FIVE='1'
npx.cmd vitest run tools/compare-twenty-five-stages.test.ts
Remove-Item Env:COMPARE_TWENTY_FIVE
```

输出 `artifacts/twenty-five-candidates.json` 及每组完整样本；采用tempered。可以设置 `TWENTY_FIVE_CANDIDATE` 为单个候选或逗号分隔列表，仅运行指定组。

历史v11验收见 `docs/reviews/2026-10-18-twenty-stages.md`。v11只追加16–20关及霜咒祭司，前十五关/八灵保持v10。第四Boss生命/普攻/横扫为950000/165/210（P），半血召唤强化。相同72条合法路线中，28条进入第十六关、22条完成第二十关，强攻/控制/经济分别7/7/8条。第16–19关平均剩余生命约82.4%/82.0%/78.0%/72.2%，第20关约36.8%（统计包含各关到场的失败样本，脚本样本不代表真实玩家通关率）。

开发服务器支持 http://127.0.0.1:5173/?playtest=stage16 与 http://127.0.0.1:5173/?playtest=stage20 ：合法完整经济路线生成的16/20关检查点，禁读写正式档，生产包不包含入口。重生检查点及完整样本：

```powershell
$env:UPDATE_TWENTY_FIXTURE='1'
npx.cmd vitest run tools/export-twenty-stages.test.ts
Remove-Item Env:UPDATE_TWENTY_FIXTURE
```

输出 `artifacts/twenty-stages-samples.json`。比较四组16–20关候选（测试进程内修改配置，结束恢复）：

```powershell
$env:COMPARE_TWENTY='1'
npx.cmd vitest run tools/compare-twenty-stages.test.ts
Remove-Item Env:COMPARE_TWENTY
```

输出 `artifacts/twenty-candidates.json` 及每组完整样本。

历史v10验收见 `docs/reviews/2026-10-18-fifteen-stages.md`。第三Boss仍为650000/135/180（P）；相同路线28条完成十五关。

历史v9平衡记录见 `docs/reviews/2026-10-16-mid-campaign-balance.md`，v8见 `docs/reviews/2026-10-16-ten-stages.md`。第一Boss生命/普攻/横扫仍为72000/55/75，第二Boss为240000/90/125（P）。v9的6–9系数、普通召唤者4000生命和10秒首召均保留。

开发服务器还支持 http://127.0.0.1:5173/?playtest=stage11 与 http://127.0.0.1:5173/?playtest=stage15 ，来自正常经济完整路线，禁止读取/写入正常存档。重生这两个检查点与十五关样本：

```powershell
$env:UPDATE_FIFTEEN_FIXTURE='1'
npx.cmd vitest run tools/export-fifteen-stages.test.ts
Remove-Item Env:UPDATE_FIFTEEN_FIXTURE
```

输出 `artifacts/fifteen-stages-samples.json`。复现历史v10的五组11–15关候选比较：

```powershell
$env:COMPARE_LATE='1'
npx.cmd vitest run tools/compare-late-campaign.test.ts
Remove-Item Env:COMPARE_LATE
```

输出 `artifacts/late-candidates.json` 和每组完整样本；默认测试跳过这些写入工具。

`src/game/testing/campaign-simulation.ts` 共用正常经济模拟。需重生第六/八/十关检查点及完整样本时运行：

```powershell
$env:UPDATE_TEN_FIXTURE='1'
npx.cmd vitest run tools/export-ten-stages.test.ts
Remove-Item Env:UPDATE_TEN_FIXTURE
```

样本写到 `artifacts/ten-stages-samples.json`。普通测试不改写检查点；本机忽略目录中的既有 `scripts/balance-*` 仍可用于第一Boss历史候选比较。

复现历史v9的15组候选比较（始终以保留的v8快照为基线，测试进程内修改，结束恢复）：

```powershell
$env:COMPARE_MID='1'
npx.cmd vitest run tools/compare-mid-campaign.test.ts
Remove-Item Env:COMPARE_MID
```

输出 `artifacts/mid-candidates.json` 与每组72条完整样本；寿命统计区分已死亡和战斗结束仍存活的观测对象。候选与最终参数均为P，待下一次原作活动实机校准。

41–50 关、剩余美术及音效、云存档和真机性能验收仍属后续范围。手机尺寸通过浏览器视口模拟检查，未替代手机实测。
