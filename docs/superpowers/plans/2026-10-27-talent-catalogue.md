# 全部天赋实施计划

**Goal:** 从手札查看全部天赋及当前入池前置。

**Architecture:** 新增纯talentCatalogue模型与TalentCatalogue列表组件，BuffJournal持有acquired/all视图状态；既有已获条目及App入口保持。

**Tech Stack:** React19、TypeScript、Vitest、Vite、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-27-talent-catalogue-design.md

本会话原生顺序实施与自审，不派代理；按用户持续授权完成实现，新增开发不提交。

## 约束与审查重点

保持规则/随机、3格、content v24/schema2、全部存储格式与容量、fixture/素材/依赖/npm命令。eligibleBuffs为唯一资格结果，说明复用同一配置字段；不把备战算上阵、不按存活排除入池、不把可入池说成已抽到、不把未获得计入摘要、不改choices或成长。默认已获、关闭重开复位；全部列表无升级操作。

## Task 1：模型

文件：新增src/ui/talent-catalogue.ts和talent-catalogue.test.ts。

- [x] 先写测试：空阵容稳定13项、通用可入池；鼠/前置/第6关门槛逐项；青锋隼/猿三阶与备战；满层排除；真实检查点战中成长优先、倒下仍保留入池，与eligibleBuffs逐项一致，JSON(session)不变。
- [x] 实现TalentCatalogueEntry{id,level,maxLevel,requirements,blockers,eligible,maxed,note}；talentCatalogue(session)根据battle优先数据与Set(eligibleBuffs(...))派生；requirements与blockers同段从字段生成，maxed单独返回，note复用talentCondition。

## Task 2：界面及验证

文件：新增TalentCatalogue.tsx及TalentCatalogue.test.tsx、BuffJournal.test.tsx；修改BuffJournal.tsx、talent-journal.css。

- [x] 先写SSR断言：全部列表13项/当前条件/层数/原名称、无动作；手札默认已获不出现未获得、空指引保留、battle优先摘要。
- [x] 列表从纯模型读取，role=list/aria-label=全部天赋；每项复用图与名称、每层效果及上限，列入池前置/当前状态/注意事项；满层优先显示，符合条件不保证出现说明。BuffJournal增加aria-pressed切换，默认acquired，切换不改关闭入口。
- [x] 使用已有主题，切换按钮44px、焦点轮廓，列表沿用模态内部滚动；只读派生与新代码simplify自审。
- [x] 定向测试，npm.cmd test及npm.cmd run build，CHECK_STARTUP_BUILD=1显式入口检查；Prettier/git diff检查。
- [x] 浏览器正常UI检查保留正式结算；隔离整备与暂停、全部/已获/重开、焦点循环、390/320宽、生产无开发入口，保存截图并清理预览/恢复视口。
- [x] 更新README及docs/reviews/2026-10-27-talent-catalogue.md，记录实际验证与限制，勾选计划。
