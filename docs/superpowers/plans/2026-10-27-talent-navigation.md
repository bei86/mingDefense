# 天赋手札流程接入 Implementation Plan

> 按用户持续“提交并下一步”授权，原生顺序执行并自审；新开发留工作区，不推送。

**Goal:** 天赋选择与本关结算可查看手札并返回原界面。

**Architecture:** CampaignPanels 通过 onBuffs 回调打开 App 已有 journal 状态；BuffJournal 接收可选 closeLabel，来源在 App 中派生，不新增状态。失败提示从 session.phase 派生。

**Tech Stack:** React 19、TypeScript、Vitest SSR、Vite、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-27-talent-navigation-design.md

## Global Constraints

保持规则、随机、3格、content v24/schema2、存档/收藏格式与容量、素材和 npm 命令。只读查看，不消费候选、不结算或推进。

## Review Focus

1. 多次待选与胜利尚待选时，关闭仍返回原候选。
2. 失败读取本场成长，明确回滚说明。
3. 普通胜败、最终胜利和单关试玩都能进入。
4. 关闭重开回到已获得；键盘只在顶层循环。
5. 320短屏可滚动并操作返回，不遮断结算操作。

## Task 1：组件与接线

- [x] 阅读 CampaignPanels、App、BuffJournal 与 useModalFocus，复用顶层模态模式。
- [x] CampaignPanels 的 TalentModal 和 ResultModal 增加 onBuffs?:()=>void；有回调时展示手札按钮。App 两处传入 ()=>setJournal(true)。
- [x] BuffJournal 增加 closeLabel?:string，默认“收起手札”；App 根据 hasChoices/胜败派生返回文案。败局渲染明确回滚说明。
- [x] SSR 覆盖多次待选、普通胜败/最终胜利/单关结果入口、失败本场成长、默认关闭文案，序列化检查只读。

## Task 2：验证与交付

- [x] 定向 SSR 与相关 talent-journal、ranged-playtest 回归；全量 npm.cmd test、npm.cmd run build。
- [x] Chrome 正常 UI 验证正式结算进出保留、隔离战斗天赋选择进出、320/390宽布局与焦点；保存截图。
- [x] React/simplify 自审、Prettier、git diff --check，更新 README 与验收文档；清理临时页及服务。
