# 灵林守阵 / mingDefense

《小妖卫道》玩法研究基础上的竖屏 H5 原型。当前完成三十五关可玩闭环：八种灵兽、1–6 阶、经验天赋、七位首领、远程/召唤/分裂敌人和本地检查点恢复。已有来源的规则继续保留，缺失数值按用户授权设计；这不是原作数值还原完成版。

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

`test` 包含规则、检查点、72条三十五关正常经济路线及前十/十五/二十/二十五/三十关回归模拟。`build` 包含 TypeScript 检查与生产构建。

## 现有图片素材预览

已接入现有生成图中的 41 张：八灵、5 类普通敌人、5 位首领、森林场景、资源/天赋图标、面板/按钮和 5 种特效。开发服务器打开 http://127.0.0.1:5173/?playtest=roster 可直接查看八灵占格效果；该入口不读取或写入正式存档。打开默认地址可正常开始或继续游戏。

原图保留在 `docs/img`，运行资源为 `public/assets/art` 的 WebP，总计约 2.68 MB。缺图敌人和第 15 关首领沿用程序绘制；第 30 关暂用羽弓变体；已有图片首领的二阶段暂用同一造型加暖色提示。角色目前为静态图，攻击仍使用程序连线和已有特效。

重新处理本地原图（仅开发工具需要 uv/Pillow，游戏运行不需要 Python）：

```powershell
uv run --with pillow python tools/prepare-game-assets.py
```

工具输出类型清单 `src/render/art-manifest.json` 和原图哈希报告 `artifacts/art-preparation.json`。本轮接入范围、排除图片和实际试玩限制见 [现有素材验收记录](docs/reviews/2026-10-20-existing-art.md)。

## 第一局与三十五关流程

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
13. 第31–34关组合快攻、护甲、远程、召唤与分裂；第35关赤角战魁为近战，15%减伤，每10秒横扫（2秒预警），每16秒召2只咒影，半血后每次4只（上限8只）、攻速+35%。清场后完成三十五关。

可点选后放置，也可拖动。同种同阶叠放合成，最高六阶；形状不随升阶改变。备战席最多两只且不参战。刷新花费 15 灵钱，获得三张招募；未领取内容需确认放弃。扩地令只解锁边相邻的一个格子。非法操作不会消耗招募、随机数或灵钱。准备期可撤销上一次布阵；刷新和遣散不能撤销。

新增灵兽：灵金桃存活时定期产钱，霜尾鲤减速并在三阶后周期冰冻，月音狐提供护盾、三阶攻击光环及五阶初始灵气。岩甲豚和青锋隼接入五阶技能。

穿林猿横占三格，沿瞄准方向贯穿，三阶施加 10% 易伤持续三秒，五阶追加第二段；已释放的第二段保持原方向，施法者或原目标死亡后继续结算。磐拳熊竖占两格，每次三道拳罡，各自只击中第一个敌人，近处同目标可中三弹；三阶命中后分裂两道 35% 伤害拳罡，不再递归分裂。新增三阶猴专属天赋“破势”，每层易伤增加 5 个百分点；熊“拳意”每层攻击 +10%，均最多三层。具体角度、碰撞、易伤时序及新增天赋为 P，等待实机校准。

敌人先清空最前方有存活灵兽的一整排，再攻击下一排；多格灵兽按最上方占格归排。同排先攻击低阶，同阶按类型仇恨优先：桃 8 > 狐 7 > 鼠 6 > 豚 5 > 熊 4 > 猴 3 > 鲤 2 > 隼 1；仍相同则按距离、实例 ID。保留用户给定六灵类型顺序，熊猴沿用豚鲤之间的预留位；等级暂按低阶优先，数字仅表示原型相对优先级 P。未查到完整原作仇恨数值表，见 `docs/research/2026-10-16-enemy-threat-and-rank.md`。选中灵兽可查看。

胜负结算可展开“逐兽战报”，查看每只上阵灵兽的实际伤害、生命承伤、桃产钱、施盾/吸收量与重伤情况；同种灵兽按位置区分。伤害不计过量部分，护盾吸收单列，失败的产钱仅供复盘、不计入保留收益。聚灵记录实际生效时间。多格灵兽以整块不透明底色遮住占格，避免误认为空格。

## 存档与重试

本地自动保存整备、关后待选天赋和完成状态。战斗中刷新、失败重试或中止会回到完整的开战检查点，本关产钱、经验和天赋全部回滚。通关奖励每关只结算一次。“重新开始”清空本轮进度。

存档键为 `ming-defense:campaign`，按 `schemaVersion` 和 `contentVersion` 验证。旧版本或损坏数据先备份再开始新局；备份失败保留原档并停止覆盖。存储不可用时仍可玩，但刷新可能丢失新进度。数据仅在当前浏览器本地保存，未实现账号和云同步。

当前内容版本为 `prototype-2026-10-21-v14`。已知 v2/v3/v4/v5/v6/v7/v8/v9/v10/v11/v12/v13 可在备份后自动迁移，保留阵容、灵钱、成长和关卡，后续新战采用当前战斗规则；旧胜利战报保留原结果，缺少逐兽数据时提供说明。旧第五/十/十五/二十/二十五/三十关完成档可继续第六/十一/十六/二十一/二十六/三十一关，既有奖励不重复。迁移备份/写入失败时原主档保留，本轮停止自动覆盖。其他未知版本仍按上述不兼容流程处理。

## 结构与校准

- `src/game/content.ts` 直接读取 `docs/superpowers/specs/2026-10-14-prototype-balance.json`，数值以该 JSON 为准，v1 快照单独保留。改数值时同步更新内容版本及对应规则说明。
- `session.ts` 管理招募、布局、合成、阶段和收益事务；商店、天赋、战斗使用独立可序列化随机状态。
- `combat.ts` / `combat-skills.ts` / `combat-projectiles.ts` / `enemy-abilities.ts` / `combat-model.ts` 是独立 50ms 模拟器，不依赖 React/Phaser；批量伤害支持同帧互杀先判负，死亡取消未释放攻击，已释放剑阵与鹰/猴双段继续生效。新易伤在本步伤害结束后施加，已有易伤乘算普通伤害；不叠加，多猴取较高值并刷新持续时间。斩杀直接移除剩余生命，不受减伤/易伤影响，只统计实际生命损失。
- `combat-diagnostics.ts` 提供可选生命周期观测，记录出生/死亡边界，包含同一步被消灭的召唤物；不进入存档，不参与随机数和战斗决策。
- `progression.ts` 处理经验、天赋条件、品质权重和上限；`persistence.ts` 验证存档并处理恢复。
- `clock.ts` 处理速度与暂停，不追补离屏时间；`render/Battlefield.tsx` 用 Phaser 绘制原创几何占位角色，`ui` 提供 DOM 操作及 HUD。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=boss ：载入正常经济模拟生成的第五关检查点，页面明确标记且禁止写存档。用于快速验收 Boss，不代表从首关手动通关；生产构建不包含该入口。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=roster ：固定八灵阵容，供占格/技能/拖动验收，页面标记并禁止写存档；不能用于证明正常经济平衡，生产构建不包含该入口。
- 仅开发服务器支持 http://127.0.0.1:5173/?playtest=stage6 、 http://127.0.0.1:5173/?playtest=stage8 和 http://127.0.0.1:5173/?playtest=stage10 ：正常经济模拟生成的第六/八/十关检查点。第八关采用未聚灵且能实际召唤的通关路线，便于验收；禁止写正常存档，检查点失效时进入禁写临时局。生产构建不包含试玩入口、检查点和模拟器测试辅助代码。

最新验收见 [三十五关验收](docs/reviews/2026-10-21-thirty-five-stages.md)。v14追加31–35关和近战护甲首领赤角战魁，前30关/八灵完整保持v13。新增参数均为P。72条合法路线中5条到达31关且完成35关（强攻3/控制1/经济1），不代表玩家通关率。新首领暂用程序轮廓，缺图清单另列两项扩展需求。

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

36–50 关、剩余美术及音效、云存档和真机性能验收仍属后续范围。手机尺寸通过浏览器视口模拟检查，未替代手机实测。
