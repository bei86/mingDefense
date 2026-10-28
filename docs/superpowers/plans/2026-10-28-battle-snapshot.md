# 暂停战场快照导出 Implementation Plan

> 用户持续授权本人自主实施、自审和验收，不派代理；本轮新开发留工作区，下轮提交。

**Goal:** 在暂停战场详情中复制和下载不受筛选影响的可读快照。

**Architecture:** 独立纯函数复用战场投影生成Markdown；默认收起组件仅展开后派生文本，复用TextExport与downloadText，App传入隔离来源。

**Tech Stack:** React19、TypeScript、Vitest、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-10-28-battle-snapshot-design.md

## Global Constraints

保持引擎/规则/数值/RNG、3格接敌、content prototype-2026-10-22-v24/schema2、存档/收藏/备份、素材、依赖和默认命令。不派代理、不推送，新开发不提交。

## Review Focus

1. 导出所有实例，不受种类/状态/排序或当前页签影响；同名实例和阵营编号不能混淆。
2. 有效护盾、死亡、缺失敌人上限/阶段、失去目标与编号0不能错误归类。
3. 冻结时间与预警准备时间分开，回响/多格当前波及不误称预测。
4. 快照不能改Session/RNG或产生存档，继续后新快照更新，关闭/异步复制沿既有取消保护。
5. 窄屏、全文选择、复制/下载失败路径复用公共实现，正式与隔离来源不混淆。

## Task 1：只读快照与测试

**Files:** 新建src/ui/battle-snapshot.ts、src/ui/battle-snapshot.test.tsx。

**Interfaces:** battleSnapshotDocument(session:Session,isolated:boolean):{fileName:string,text:string}|null。

- [x] 添加真实Combat/Session、重复只读与刷新、门禁、编号0/同名/倒下/有效盾、旧字段/丢失目标、冻结/回响/多格预警、备战/天赋/空队列测试，先验证缺模块失败。
- [x] 复用battleInspection、enemyInspection、upcomingEnemies生成确定性文本；null门禁检查session.phase、paused、hasChoices、pendingChoices和battle.result，正文不携带完整存档或RNG。

```ts
if (
  !session.battle ||
  session.phase !== 'combat' ||
  !session.paused ||
  session.hasChoices ||
  session.battle.pendingChoices > 0 ||
  session.battle.result !== null
)
  return null;
```

## Task 2：导出入口与验收

**Files:** 新建src/ui/BattleSnapshot.tsx；修改src/ui/BattleInspection.tsx、src/ui/App.tsx、README.md；新增docs/reviews/2026-10-28-battle-snapshot.md。

**Interfaces:** BattleSnapshot({session,isolated}:{session:Session,isolated:boolean})；BattleSnapshotContent({document}:{document:{fileName:string,text:string}})。

- [x] 默认收起details，展开才调用生成器，null状态不提供操作；Content复用TextExport，复制/下载/选中文本均由用户操作触发。

```tsx
<TextExport
  text={document.text}
  label="当前战场快照（可手动全选复制）"
  copyLabel="复制战场快照"
  copiedNotice="战场快照已复制。"
  download={{
    label: '下载战场快照',
    run: () => {
      try {
        downloadText(document.text, document.fileName, 'text/markdown;charset=utf-8');
        return '已发起快照下载，请检查浏览器下载记录；也可复制下方文本。';
      } catch {
        return '下载不可用，请复制下方快照文本保存。';
      }
    },
  }}
/>
```

- [x] BattleInspection共用底部接入，isolated可选默认false兼容既有调用，App明确传boot.isolated。SSR验证默认收起、完整正文/关联ID与来源，定向测试/typecheck及React/simplify自审。
- [x] 全量test/build、显式CHECK_STARTUP_BUILD=1、格式/diff检查。
- [x] 隔离stage50桌面浏览器验证完整数据、不受筛选/切页影响、档案与重开、继续后刷新、复制成功提示/下载发起提示及手动选择；结束主试玩，正式页只读核对。
- [ ] 补充320/390实测、剪贴板内容与下载文件落地核对。浏览器会话中途失联；旧试玩未附加导致视口覆盖失败，实际仍1920×911，不能使用390命名截图冒充窄屏。下载事件超时，访问浏览器下载页被工具URL策略拒绝，不绕过限制。
- [x] 更新README、验收文档与计划，明确自动/浏览器覆盖边界，新开发留工作区。

## 验证命令

```powershell
npx.cmd vitest run src/ui/battle-snapshot.test.tsx src/ui/battle-inspection.test.ts src/ui/enemy-inspection.test.ts src/ui/TextExport.test.tsx src/ui/report-copy.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:CHECK_STARTUP_BUILD='1'
try { npx.cmd vitest run tools/startup-build.test.ts }
finally { Remove-Item Env:CHECK_STARTUP_BUILD }
```
