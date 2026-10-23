# 单套阵型分享码实施计划

**Goal:** 单套预设可复制文本分享，校验预览并确认后保存到所选槽位。

**Architecture:** formation-share为有界纯编解码；PresetBoard抽出复用；FormationShare负责输入/待确认状态，只通过既有library.update持久化，不接收Session写接口。

**Tech Stack:** TypeScript、React19、Vitest、既有CSS，无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-formation-share-design.md`

## 执行约束

延续用户连续开发授权，在当前会话顺序实现，不派子代理、不重复设置审批。先前已提交bc2dda0；本轮新功能不提交、不推送。不改数值、规则、三格接敌、战役/预设存储格式、依赖或原启动命令。8KiB UTF-8输入上限，沿validFormation校验，导入只保存预设。

## Review Focus

1. 相同种类/阶数和备战的位置序列完整保留，ID和资源不进入分享。
2. 多格边界、重叠、备战上限、未知版本与UTF-8字节上限拒绝，无部分导入。
3. 校验和取消不写入；编辑、切槽、收起后旧预览不能确认。
4. 读取或写入失败保留原槽，导入不改Session和其他槽；开发隔离继续生效。
5. 空槽也可导入；不匹配阵容可保存但不可应用，320宽预览及确认可达。

## 任务1：纯编解码与存储接合测试

Files: 新`src/ui/formation-share.ts`、`src/ui/formation-share.test.ts`。

- [x] 写往返失败测试，先运行确认模块缺失：

```ts
const text = createFormationShare(preset);
const result = inspectFormationShare(text);
expect(result).toEqual({ok: true, preset});
```

- [x] 实现`createFormationShare(preset: FormationPreset): string`（无效抛错）与`inspectFormationShare(text: string): {ok:true;preset:FormationPreset}|{ok:false;error:string}`。固定格式/版本、UTF-8上限8192，validFormation后只映射kind/rank/position。
- [x] 覆盖八灵/多格/重复实例/备战、非法格式/阶数/坐标/上限、8KiB边界、引用分离、规范化剔除拥有权字段、Session完整不变、写入选中槽与坏库/配额失败；运行新测试及已有存储/预设/hook测试。

## 任务2：预览确认UI与交付

Files: 新`src/ui/PresetBoard.tsx`、`src/ui/FormationShare.tsx`、`src/ui/formation-share.css`；改`FormationPresets.tsx`、README；新review。

- [x] 原样抽出PresetBoard；FormationShare props为slot/preset/blocked/isolated/onImport，默认收起，按slot独立key挂载，原save/delete待确认时卸载。
- [x] 生成及复制提供只读文本；粘贴→校验→完整小图/数量→确认或取消。onChange清预览，收起卸载内容重置，确认沿onImport返回error决定成功；不可用时明确提示。文本不触发自动导入。
- [x] 复用既有写库与应用规则，导入无自动应用；CSS限定、summary与按钮44px，320宽文本框不溢出。
- [x] React最佳实践/simplify复查；定向与全量测试、build、显式startup-build、Prettier和空白检查。
- [x] game-playtest验证开发隔离保存/分享/取消/旧预览失效/切槽/导入/应用/撤销，390/320与键盘；生产验证原进度与空槽恢复，控制台与截图证据。
- [x] README/review写实际证据和边界，勾计划；关闭自己的标签、恢复视口、停止自己的服务，保留新功能未提交。
